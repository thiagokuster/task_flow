-- TaskFlow v1: core schema with strict per-user isolation

-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Forces ownership to the authenticated user (client can never choose owner)
CREATE OR REPLACE FUNCTION public.force_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN NEW.user_id = auth.uid();
    ELSIF NEW.user_id <> OLD.user_id THEN RAISE EXCEPTION 'owner cannot change';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '' CHECK (char_length(full_name) <= 120),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo' CHECK (char_length(timezone) <= 64),
  notify_deadlines boolean NOT NULL DEFAULT true,
  notify_days_before smallint NOT NULL DEFAULT 1 CHECK (notify_days_before BETWEEN 0 AND 14),
  terms_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, terms_accepted_at)
  VALUES (
    NEW.id,
    left(coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), 120),
    CASE WHEN NEW.raw_user_meta_data ? 'terms_accepted' THEN now() ELSE NULL END
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PROJECTS
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  color text NOT NULL DEFAULT 'teal' CHECK (color ~ '^[a-z]{3,12}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  UNIQUE (user_id, name)
);
-- CATEGORIES
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  UNIQUE (user_id, name)
);
-- TAGS
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  UNIQUE (user_id, name)
);

-- TASKS (composite FKs guarantee project/category belong to the same owner)
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','archived')),
  due_at timestamptz,
  completed_at timestamptz,
  project_id uuid,
  category_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  FOREIGN KEY (project_id, user_id) REFERENCES public.projects(id, user_id) ON DELETE SET NULL (project_id),
  FOREIGN KEY (category_id, user_id) REFERENCES public.categories(id, user_id) ON DELETE SET NULL (category_id)
);
CREATE INDEX tasks_user_status_idx ON public.tasks(user_id, status);
CREATE INDEX tasks_user_due_idx ON public.tasks(user_id, due_at);
CREATE INDEX tasks_project_idx ON public.tasks(project_id);
CREATE INDEX tasks_category_idx ON public.tasks(category_id);

CREATE OR REPLACE FUNCTION public.tasks_completed_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'done' AND (TG_OP = 'INSERT' OR OLD.status <> 'done') THEN NEW.completed_at = now();
  ELSIF NEW.status <> 'done' THEN NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END; $$;

-- TASK_TAGS
CREATE TABLE public.task_tags (
  task_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, tag_id),
  FOREIGN KEY (task_id, user_id) REFERENCES public.tasks(id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id, user_id) REFERENCES public.tags(id, user_id) ON DELETE CASCADE
);
CREATE INDEX task_tags_tag_idx ON public.task_tags(tag_id);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id uuid,
  kind text NOT NULL CHECK (kind IN ('due_soon','overdue')),
  message text NOT NULL CHECK (char_length(message) <= 300),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (task_id, user_id) REFERENCES public.tasks(id, user_id) ON DELETE CASCADE,
  UNIQUE (task_id, kind)
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- AUDIT EVENTS (minimal, no secrets)
CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_user_idx ON public.audit_events(user_id, created_at DESC);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects, public.categories, public.tags, public.tasks TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.task_tags TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.projects, public.categories, public.tags, public.tasks, public.task_tags, public.notifications, public.audit_events TO service_role;

-- RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','categories','tags','tasks'] LOOP
    EXECUTE format('CREATE POLICY "%1$s_select_own" ON public.%1$s FOR SELECT TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "%1$s_insert_own" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "%1$s_update_own" ON public.%1$s FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "%1$s_delete_own" ON public.%1$s FOR DELETE TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE TRIGGER %1$s_owner BEFORE INSERT OR UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.force_owner()', t);
    EXECUTE format('CREATE TRIGGER %1$s_updated BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;
CREATE TRIGGER tasks_completed BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.tasks_completed_at();

CREATE POLICY "task_tags_select_own" ON public.task_tags FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "task_tags_insert_own" ON public.task_tags FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "task_tags_delete_own" ON public.task_tags FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER task_tags_owner BEFORE INSERT ON public.task_tags FOR EACH ROW EXECUTE FUNCTION public.force_owner();

CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "audit_select_own" ON public.audit_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Audit task create/delete automatically
CREATE OR REPLACE FUNCTION public.audit_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN INSERT INTO public.audit_events(user_id, event) VALUES (NEW.user_id, 'task_created');
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = OLD.user_id) THEN
      INSERT INTO public.audit_events(user_id, event) VALUES (OLD.user_id, 'task_deleted');
    END IF;
  ELSIF NEW.status = 'done' AND OLD.status <> 'done' THEN INSERT INTO public.audit_events(user_id, event) VALUES (NEW.user_id, 'task_completed');
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER tasks_audit AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.audit_task();

-- Security event logging from the client (allow-listed events only, caller = auth.uid())
CREATE OR REPLACE FUNCTION public.log_security_event(_event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _event NOT IN ('sign_in','sign_out','sign_out_others','password_changed','mfa_enabled','mfa_disabled','data_exported','profile_updated') THEN
    RAISE EXCEPTION 'invalid event';
  END IF;
  INSERT INTO public.audit_events(user_id, event) VALUES (auth.uid(), _event);
END; $$;
REVOKE ALL ON FUNCTION public.log_security_event(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text) TO authenticated;

-- Deadline notifications for the current user (idempotent)
CREATE OR REPLACE FUNCTION public.refresh_my_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles; n integer := 0; c integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND OR NOT p.notify_deadlines THEN RETURN 0; END IF;
  INSERT INTO public.notifications(user_id, task_id, kind, message)
  SELECT t.user_id, t.id, 'overdue', 'Tarefa vencida: ' || left(t.title, 200)
  FROM public.tasks t WHERE t.user_id = auth.uid() AND t.status IN ('pending','in_progress') AND t.due_at < now()
  ON CONFLICT (task_id, kind) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  INSERT INTO public.notifications(user_id, task_id, kind, message)
  SELECT t.user_id, t.id, 'due_soon', 'Prazo próximo: ' || left(t.title, 200)
  FROM public.tasks t WHERE t.user_id = auth.uid() AND t.status IN ('pending','in_progress')
    AND t.due_at >= now() AND t.due_at <= now() + make_interval(days => greatest(p.notify_days_before, 0)) + interval '1 day'
  ON CONFLICT (task_id, kind) DO NOTHING;
  GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.refresh_my_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_my_notifications() TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_task() FROM PUBLIC, anon, authenticated;
