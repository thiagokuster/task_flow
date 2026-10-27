-- Group-task extras: comments, assignment notifications, Realtime.
-- is_group_member / can_access_task are SECURITY DEFINER to avoid RLS recursion.

CREATE OR REPLACE FUNCTION public.can_access_task(_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = _task_id
      AND auth.uid() IS NOT NULL
      AND (
        t.user_id = auth.uid()
        OR (t.group_id IS NOT NULL AND public.is_group_member(t.group_id))
      )
  );
$$;

CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_comments_task_idx ON public.task_comments(task_id, created_at);

CREATE OR REPLACE FUNCTION public.task_comments_force_author()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.author_id = auth.uid();
  END IF;
  NEW.body = btrim(NEW.body);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_comments_force_author ON public.task_comments;
CREATE TRIGGER task_comments_force_author BEFORE INSERT ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.task_comments_force_author();

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;

DROP POLICY IF EXISTS "task_comments_select" ON public.task_comments;
DROP POLICY IF EXISTS "task_comments_insert" ON public.task_comments;
DROP POLICY IF EXISTS "task_comments_delete" ON public.task_comments;

CREATE POLICY "task_comments_select" ON public.task_comments
  FOR SELECT TO authenticated USING (public.can_access_task(task_id));
CREATE POLICY "task_comments_insert" ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_task(task_id) AND author_id = auth.uid());
CREATE POLICY "task_comments_delete" ON public.task_comments
  FOR DELETE TO authenticated USING (author_id = auth.uid());

-- Assignment notifications: recipient is the assignee, not always tasks.user_id.
DO $$
DECLARE n text;
BEGIN
  SELECT conname INTO n
  FROM pg_constraint
  WHERE conrelid = 'public.notifications'::regclass
    AND contype = 'f'
    AND pg_get_constraintdef(oid) ILIKE '%task_id%'
    AND pg_get_constraintdef(oid) ILIKE '%user_id%';
  IF n IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', n);
  END IF;

  SELECT conname INTO n
  FROM pg_constraint
  WHERE conrelid = 'public.notifications'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%kind%';
  IF n IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', n);
  END IF;

  SELECT conname INTO n
  FROM pg_constraint
  WHERE conrelid = 'public.notifications'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%task_id%'
    AND pg_get_constraintdef(oid) ILIKE '%kind%'
    AND pg_get_constraintdef(oid) NOT ILIKE '%user_id%';
  IF n IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', n);
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_kind_check
    CHECK (kind IN ('due_soon', 'overdue', 'assigned'));
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_user_task_kind_key UNIQUE (user_id, task_id, kind);
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor text;
BEGIN
  IF NEW.assignee_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.assignee_id = COALESCE(auth.uid(), NEW.created_by) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id THEN
    RETURN NEW;
  END IF;

  SELECT left(COALESCE(NULLIF(btrim(full_name), ''), 'Alguém'), 80)
    INTO actor
  FROM public.profiles
  WHERE id = COALESCE(auth.uid(), NEW.created_by);

  INSERT INTO public.notifications (user_id, task_id, kind, message)
  VALUES (
    NEW.assignee_id,
    NEW.id,
    'assigned',
    left(COALESCE(actor, 'Alguém') || ' atribuiu a você: ' || NEW.title, 300)
  )
  ON CONFLICT (user_id, task_id, kind) DO UPDATE
    SET message = EXCLUDED.message,
        read_at = NULL,
        created_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_notify_assigned ON public.tasks;
CREATE TRIGGER tasks_notify_assigned AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

CREATE OR REPLACE FUNCTION public.refresh_my_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles; n integer := 0; c integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND OR NOT p.notify_deadlines THEN RETURN 0; END IF;

  INSERT INTO public.notifications(user_id, task_id, kind, message)
  SELECT auth.uid(), t.id, 'overdue', 'Tarefa vencida: ' || left(t.title, 200)
  FROM public.tasks t
  WHERE t.status IN ('pending', 'in_progress')
    AND t.due_at < now()
    AND (
      (t.group_id IS NULL AND t.user_id = auth.uid())
      OR (t.group_id IS NOT NULL AND t.assignee_id = auth.uid())
    )
  ON CONFLICT (user_id, task_id, kind) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; n := n + c;

  INSERT INTO public.notifications(user_id, task_id, kind, message)
  SELECT auth.uid(), t.id, 'due_soon', 'Prazo próximo: ' || left(t.title, 200)
  FROM public.tasks t
  WHERE t.status IN ('pending', 'in_progress')
    AND t.due_at >= now()
    AND t.due_at <= now() + make_interval(days => greatest(p.notify_days_before, 0)) + interval '1 day'
    AND (
      (t.group_id IS NULL AND t.user_id = auth.uid())
      OR (t.group_id IS NOT NULL AND t.assignee_id = auth.uid())
    )
  ON CONFLICT (user_id, task_id, kind) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; n := n + c;

  RETURN n;
END;
$$;

ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.task_comments REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.groups REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_object THEN NULL;
END $$;

REVOKE ALL ON FUNCTION public.can_access_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_task(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.task_comments_force_author() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_task_assigned() FROM PUBLIC, anon, authenticated;
