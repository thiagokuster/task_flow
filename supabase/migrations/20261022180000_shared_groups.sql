-- Shared groups: groups, membership, optional group tasks, invite codes.
-- is_group_member / is_group_owner are SECURITY DEFINER so RLS never reads
-- group_members under its own policies (avoids infinite recursion).

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE code text;
BEGIN
  LOOP
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.groups WHERE invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  invite_code text NOT NULL UNIQUE CHECK (invite_code ~ '^[A-Z0-9]{8}$'),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX group_members_user_idx ON public.group_members(user_id);

CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid, _user_id uuid DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.groups_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  IF NEW.invite_code IS NULL OR btrim(NEW.invite_code) = '' THEN
    NEW.invite_code = public.generate_invite_code();
  ELSE
    NEW.invite_code = upper(btrim(NEW.invite_code));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.groups_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER groups_before_insert BEFORE INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.groups_before_insert();
CREATE TRIGGER groups_after_insert AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.groups_after_insert();
CREATE TRIGGER groups_updated BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT;

UPDATE public.tasks SET created_by = user_id WHERE created_by IS NULL;
ALTER TABLE public.tasks ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.tasks ALTER COLUMN created_by SET NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_group_idx ON public.tasks(group_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_idx ON public.tasks(assignee_id);

CREATE OR REPLACE FUNCTION public.tasks_force_creator()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
  ELSIF NEW.assignee_id IS NOT NULL AND NOT public.is_group_member(NEW.group_id, NEW.assignee_id) THEN
    RAISE EXCEPTION 'assignee must be a group member';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_force_creator ON public.tasks;
CREATE TRIGGER tasks_force_creator BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_force_creator();

-- Groups RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.groups, public.group_members TO service_role;

CREATE POLICY "groups_select_member" ON public.groups
  FOR SELECT TO authenticated USING (public.is_group_member(id));
CREATE POLICY "groups_insert_own" ON public.groups
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
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

-- Replace owner-only task policies so group members can collaborate.
DROP POLICY IF EXISTS "tasks_select_own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_own" ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (group_id IS NOT NULL AND public.is_group_member(group_id))
  );

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      group_id IS NULL
      OR (
        public.is_group_member(group_id)
        AND (assignee_id IS NULL OR public.is_group_member(group_id, assignee_id))
      )
    )
  );

CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR (group_id IS NOT NULL AND public.is_group_member(group_id))
  )
  WITH CHECK (
    (group_id IS NULL AND auth.uid() = user_id)
    OR (
      group_id IS NOT NULL
      AND public.is_group_member(group_id)
      AND (assignee_id IS NULL OR public.is_group_member(group_id, assignee_id))
    )
  );

CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR (group_id IS NOT NULL AND (created_by = auth.uid() OR public.is_group_owner(group_id)))
  );

CREATE OR REPLACE FUNCTION public.preview_group(_code text)
RETURNS TABLE (id uuid, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  RETURN QUERY
    SELECT g.id, g.name
    FROM public.groups g
    WHERE g.invite_code = upper(btrim(_code));
END;
$$;

CREATE OR REPLACE FUNCTION public.join_group(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE gid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT g.id INTO gid FROM public.groups g WHERE g.invite_code = upper(btrim(_code));
  IF gid IS NULL THEN RAISE EXCEPTION 'invalid invite'; END IF;
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (gid, auth.uid(), 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN gid;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.groups_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.groups_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tasks_force_creator() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_group_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_owner(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.preview_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_group(text) TO authenticated;

REVOKE ALL ON FUNCTION public.join_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group(text) TO authenticated;
