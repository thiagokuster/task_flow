-- Invite entropy + expiry + rate limit, due-date enforcement, tighter group
-- UPDATE, membership-oracle fix, LGPD FK behavior.

-- ---------------------------------------------------------------------------
-- Helpers: membership checks that clients cannot probe for other users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._user_is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public._user_is_group_owner(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id AND role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public._user_is_group_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._user_is_group_owner(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Break dependencies so the two-argument signatures can be dropped.
CREATE OR REPLACE FUNCTION public.can_access_task(_task_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT false; $$;

CREATE OR REPLACE FUNCTION public.tasks_force_creator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN NEW; END; $$;

DROP POLICY IF EXISTS "groups_select_member" ON public.groups;
DROP POLICY IF EXISTS "groups_insert_own" ON public.groups;
DROP POLICY IF EXISTS "groups_update_owner" ON public.groups;
DROP POLICY IF EXISTS "groups_delete_owner" ON public.groups;
DROP POLICY IF EXISTS "group_members_select" ON public.group_members;
DROP POLICY IF EXISTS "group_members_insert_owner" ON public.group_members;
DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
DROP POLICY IF EXISTS "profiles_select_group_peers" ON public.profiles;
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_group_owner(uuid, uuid);

CREATE FUNCTION public.is_group_member(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._user_is_group_member(_group_id, auth.uid());
$$;

CREATE FUNCTION public.is_group_owner(_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._user_is_group_owner(_group_id, auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.is_group_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_group_owner(uuid) FROM PUBLIC, anon;

CREATE POLICY "groups_select_member" ON public.groups
  FOR SELECT TO authenticated USING (public.is_group_member(id));
CREATE POLICY "groups_insert_own" ON public.groups
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "groups_update_owner" ON public.groups
  FOR UPDATE TO authenticated USING (public.is_group_owner(id)) WITH CHECK (public.is_group_owner(id));
CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE TO authenticated USING (public.is_group_owner(id));

CREATE POLICY "group_members_select" ON public.group_members
  FOR SELECT TO authenticated USING (public.is_group_member(group_id));
CREATE POLICY "group_members_insert_owner" ON public.group_members
  FOR INSERT TO authenticated WITH CHECK (public.is_group_owner(group_id));
CREATE POLICY "group_members_delete" ON public.group_members
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_group_owner(group_id));

CREATE POLICY "profiles_select_group_peers" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.user_id = profiles.id AND public.is_group_member(gm.group_id)
    )
  );

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (group_id IS NOT NULL AND public.is_group_member(group_id))
  );

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (group_id IS NULL OR public.is_group_member(group_id))
  );

-- Group edits: creator, assignee or group owner. Personal tasks: row owner.
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      group_id IS NOT NULL
      AND public.is_group_member(group_id)
      AND (created_by = auth.uid() OR assignee_id = auth.uid() OR public.is_group_owner(group_id))
    )
  )
  WITH CHECK (
    (group_id IS NULL AND auth.uid() = user_id)
    OR (
      group_id IS NOT NULL
      AND public.is_group_member(group_id)
      AND (created_by = auth.uid() OR assignee_id = auth.uid() OR public.is_group_owner(group_id))
    )
  );

CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR (group_id IS NOT NULL AND (created_by = auth.uid() OR public.is_group_owner(group_id)))
  );

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

CREATE OR REPLACE FUNCTION public.tasks_force_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  ELSIF NEW.assignee_id IS NOT NULL AND NOT public._user_is_group_member(NEW.group_id, NEW.assignee_id) THEN
    RAISE EXCEPTION 'assignee must be a group member';
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

-- ---------------------------------------------------------------------------
-- Stronger, expiring invite codes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE code text;
BEGIN
  LOOP
    code := upper(substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 32));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups WHERE invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.groups'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%invite_code%'
  LOOP
    EXECUTE format('ALTER TABLE public.groups DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.groups_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  NEW.invite_code = public.generate_invite_code();
  NEW.invite_expires_at = now() + interval '7 days';
  RETURN NEW;
END;
$$;

UPDATE public.groups
SET
  invite_code = public.generate_invite_code(),
  invite_expires_at = COALESCE(invite_expires_at, now() + interval '7 days');

ALTER TABLE public.groups
  ALTER COLUMN invite_expires_at SET DEFAULT (now() + interval '7 days'),
  ALTER COLUMN invite_expires_at SET NOT NULL;

ALTER TABLE public.groups
  ADD CONSTRAINT groups_invite_code_check CHECK (invite_code ~ '^[A-F0-9]{32}$');

CREATE TABLE IF NOT EXISTS public.invite_join_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invite_join_attempts_user_idx
  ON public.invite_join_attempts (user_id, attempted_at DESC);

ALTER TABLE public.invite_join_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invite_join_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.invite_join_attempts TO service_role;

CREATE OR REPLACE FUNCTION public._invite_rate_limit()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  DELETE FROM public.invite_join_attempts
    WHERE user_id = auth.uid() AND attempted_at < now() - interval '1 day';
  INSERT INTO public.invite_join_attempts (user_id) VALUES (auth.uid());
  SELECT count(*) INTO n FROM public.invite_join_attempts
    WHERE user_id = auth.uid() AND attempted_at > now() - interval '15 minutes';
  IF n > 10 THEN
    RAISE EXCEPTION 'too many invite attempts';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._invite_rate_limit() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.preview_group(text);

CREATE FUNCTION public.preview_group(_code text)
RETURNS TABLE (id uuid, name text, invite_expired boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE g public.groups%ROWTYPE;
BEGIN
  PERFORM public._invite_rate_limit();
  SELECT * INTO g FROM public.groups WHERE invite_code = upper(btrim(_code));
  IF NOT FOUND THEN RETURN; END IF;
  IF g.invite_expires_at <= now() THEN
    id := NULL;
    name := NULL;
    invite_expired := true;
    RETURN NEXT;
    RETURN;
  END IF;
  id := g.id;
  name := g.name;
  invite_expired := false;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_group(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE g public.groups%ROWTYPE;
BEGIN
  PERFORM public._invite_rate_limit();
  SELECT * INTO g FROM public.groups WHERE invite_code = upper(btrim(_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid invite'; END IF;
  IF g.invite_expires_at <= now() THEN RAISE EXCEPTION 'invite expired'; END IF;
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (g.id, auth.uid(), 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN g.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rotate_invite_code(_group_id uuid)
RETURNS TABLE (invite_code text, invite_expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_group_owner(_group_id) THEN RAISE EXCEPTION 'not group owner'; END IF;
  RETURN QUERY
    UPDATE public.groups g
    SET
      invite_code = public.generate_invite_code(),
      invite_expires_at = now() + interval '7 days',
      updated_at = now()
    WHERE g.id = _group_id
    RETURNING g.invite_code, g.invite_expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.preview_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_group(text) TO authenticated;
REVOKE ALL ON FUNCTION public.join_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group(text) TO authenticated;
REVOKE ALL ON FUNCTION public.rotate_invite_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_invite_code(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- LGPD: deleting a user must not fail on created_by, and must not silently
-- wipe a group that still has other members (RESTRICT + app handoff).
-- ---------------------------------------------------------------------------
DO $$
DECLARE n text;
BEGIN
  SELECT conname INTO n FROM pg_constraint
  WHERE conrelid = 'public.tasks'::regclass AND contype = 'f'
    AND pg_get_constraintdef(oid) ILIKE '%created_by%';
  IF n IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT %I', n);
  END IF;
END $$;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

DO $$
DECLARE n text;
BEGIN
  SELECT conname INTO n FROM pg_constraint
  WHERE conrelid = 'public.groups'::regclass AND contype = 'f'
    AND pg_get_constraintdef(oid) ILIKE '%created_by%';
  IF n IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.groups DROP CONSTRAINT %I', n);
  END IF;
END $$;

ALTER TABLE public.groups
  ADD CONSTRAINT groups_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT;
