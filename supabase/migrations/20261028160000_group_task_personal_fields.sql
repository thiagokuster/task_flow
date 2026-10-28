-- Group tasks must not carry personal project/category/tags: those composite
-- FKs block prepare_account_deletion when user_id is reassigned. Also keep
-- names of people who left the group but still appear on shared tasks/comments.
--
-- app.account_deletion is a transaction-local GUC (SET LOCAL). PostgREST does
-- not expose SET/set_config to clients; only a role that can run arbitrary SQL
-- could flip it and skip force_owner.
--
-- Recreate the deletion helpers here so this file is safe to run even if
-- 20261027210000 was skipped (the new trigger would otherwise break inserts).

CREATE OR REPLACE FUNCTION public._account_deletion_in_progress()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(nullif(current_setting('app.account_deletion', true), ''), '') = 'on';
$$;

REVOKE ALL ON FUNCTION public._account_deletion_in_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._account_deletion_in_progress() TO authenticated;

CREATE OR REPLACE FUNCTION public._require_recent_login(_max_age_sec integer DEFAULT 600)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE latest bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT max((elem->>'timestamp')::bigint)
    INTO latest
  FROM jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) AS elem
  WHERE (elem->>'timestamp') ~ '^[0-9]+$';
  IF latest IS NULL OR extract(epoch FROM clock_timestamp()) - latest > _max_age_sec THEN
    RAISE EXCEPTION 'reauthentication required';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._require_recent_login(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tasks_force_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._account_deletion_in_progress() THEN
    IF auth.uid() IS NOT NULL THEN
      IF TG_OP = 'INSERT' THEN
        NEW.created_by = auth.uid();
      ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'creator cannot change';
      END IF;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.group_id IS DISTINCT FROM OLD.group_id THEN
      RAISE EXCEPTION 'group cannot change';
    END IF;
    IF NEW.group_id IS NULL THEN
      NEW.assignee_id = NULL;
    ELSE
      IF NEW.project_id IS NOT NULL OR NEW.category_id IS NOT NULL THEN
        RAISE EXCEPTION 'group tasks cannot have a project or category';
      END IF;
      IF NEW.assignee_id IS NOT NULL AND NOT public._user_is_group_member(NEW.group_id, NEW.assignee_id) THEN
        RAISE EXCEPTION 'assignee must be a group member';
      END IF;
    END IF;
  END IF;
  IF NEW.due_at IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.due_at IS DISTINCT FROM OLD.due_at) THEN
    IF (NEW.due_at AT TIME ZONE 'America/Sao_Paulo')::date
         < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
      RAISE EXCEPTION 'due date cannot be in the past';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tasks_force_creator() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.task_tags_reject_group_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tasks WHERE id = NEW.task_id AND group_id IS NOT NULL) THEN
    RAISE EXCEPTION 'group tasks cannot have tags';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_tags_reject_group_task ON public.task_tags;
CREATE TRIGGER task_tags_reject_group_task
  BEFORE INSERT OR UPDATE ON public.task_tags
  FOR EACH ROW EXECUTE FUNCTION public.task_tags_reject_group_task();

REVOKE ALL ON FUNCTION public.task_tags_reject_group_task() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.prepare_account_deletion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
DECLARE r record;
DECLARE successor uuid;
BEGIN
  PERFORM public._require_recent_login();
  PERFORM set_config('app.account_deletion', 'on', true);

  FOR r IN
    SELECT g.id
    FROM public.groups g
    WHERE g.created_by = uid
       OR EXISTS (
         SELECT 1 FROM public.group_members m
         WHERE m.group_id = g.id AND m.user_id = uid AND m.role = 'owner'
       )
  LOOP
    SELECT user_id INTO successor
    FROM public.group_members
    WHERE group_id = r.id AND user_id IS DISTINCT FROM uid
    ORDER BY joined_at, user_id
    LIMIT 1;

    IF successor IS NULL THEN
      DELETE FROM public.groups WHERE id = r.id;
    ELSE
      UPDATE public.group_members SET role = 'owner'
      WHERE group_id = r.id AND user_id = successor;
      UPDATE public.groups SET created_by = successor, updated_at = now()
      WHERE id = r.id;
      DELETE FROM public.group_members WHERE group_id = r.id AND user_id = uid;
    END IF;
  END LOOP;

  DELETE FROM public.task_tags tt
  USING public.tasks t
  WHERE tt.task_id = t.id
    AND t.group_id IS NOT NULL
    AND (t.user_id = uid OR t.created_by = uid OR t.assignee_id = uid);

  UPDATE public.tasks t
  SET project_id = NULL, category_id = NULL
  WHERE t.group_id IS NOT NULL
    AND (t.user_id = uid OR t.created_by = uid OR t.assignee_id = uid);

  UPDATE public.tasks t
  SET
    user_id = COALESCE(NULLIF(t.assignee_id, uid), g.created_by),
    created_by = COALESCE(NULLIF(t.created_by, uid), NULLIF(t.assignee_id, uid), g.created_by),
    assignee_id = CASE WHEN t.assignee_id = uid THEN NULL ELSE t.assignee_id END
  FROM public.groups g
  WHERE t.group_id = g.id
    AND (t.user_id = uid OR t.created_by = uid OR t.assignee_id = uid);

  DELETE FROM public.group_members WHERE user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion() TO authenticated;

CREATE OR REPLACE VIEW public.group_profiles
WITH (security_invoker = false, security_barrier = true) AS
SELECT p.id, p.full_name
FROM public.profiles p
WHERE p.id = auth.uid()
   OR EXISTS (
     SELECT 1 FROM public.group_members gm
     WHERE gm.user_id = p.id AND public.is_group_member(gm.group_id)
   )
   OR EXISTS (
     SELECT 1 FROM public.task_comments c
     WHERE c.author_id = p.id AND public.can_access_task(c.task_id)
   )
   OR EXISTS (
     SELECT 1 FROM public.tasks t
     WHERE (t.assignee_id = p.id OR t.created_by = p.id)
       AND public.can_access_task(t.id)
   );

REVOKE ALL ON public.group_profiles FROM PUBLIC;
REVOKE ALL ON public.group_profiles FROM anon;
GRANT SELECT ON public.group_profiles TO authenticated;
GRANT ALL ON public.group_profiles TO service_role;
