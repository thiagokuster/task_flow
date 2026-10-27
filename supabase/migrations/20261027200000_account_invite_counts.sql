-- Commit invite attempts (no RAISE after INSERT), prepare account deletion
-- without deleting colleagues' group tasks, comment counts RPC, tighter
-- membership insert and peer profile columns.

CREATE OR REPLACE FUNCTION public._invite_rate_ok()
RETURNS boolean
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
  RETURN n <= 10;
END;
$$;

REVOKE ALL ON FUNCTION public._invite_rate_ok() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._invite_rate_limit() FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.join_group(text);
DROP FUNCTION IF EXISTS public.preview_group(text);

CREATE FUNCTION public.preview_group(_code text)
RETURNS TABLE (id uuid, name text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE g public.groups%ROWTYPE;
BEGIN
  IF NOT public._invite_rate_ok() THEN
    id := NULL;
    name := NULL;
    status := 'rate_limited';
    RETURN NEXT;
    RETURN;
  END IF;
  SELECT * INTO g FROM public.groups WHERE invite_code = upper(btrim(_code));
  IF NOT FOUND THEN
    status := 'invalid';
    RETURN NEXT;
    RETURN;
  END IF;
  IF g.invite_expires_at <= now() THEN
    status := 'expired';
    RETURN NEXT;
    RETURN;
  END IF;
  id := g.id;
  name := g.name;
  status := 'ok';
  RETURN NEXT;
END;
$$;

CREATE FUNCTION public.join_group(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE g public.groups%ROWTYPE;
BEGIN
  IF NOT public._invite_rate_ok() THEN
    RETURN jsonb_build_object('status', 'rate_limited');
  END IF;
  SELECT * INTO g FROM public.groups WHERE invite_code = upper(btrim(_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;
  IF g.invite_expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (g.id, auth.uid(), 'member')
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN jsonb_build_object('status', 'ok', 'group_id', g.id);
END;
$$;

REVOKE ALL ON FUNCTION public.preview_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_group(text) TO authenticated;
REVOKE ALL ON FUNCTION public.join_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_group(text) TO authenticated;

-- Membership only via join_group / create_group triggers (SECURITY DEFINER).
DROP POLICY IF EXISTS "group_members_insert_owner" ON public.group_members;

-- Peers only see id + name, not timezone / notification prefs / terms.
DROP POLICY IF EXISTS "profiles_select_group_peers" ON public.profiles;

CREATE OR REPLACE VIEW public.group_profiles
WITH (security_invoker = false, security_barrier = true) AS
SELECT p.id, p.full_name
FROM public.profiles p
WHERE p.id = auth.uid()
   OR EXISTS (
     SELECT 1 FROM public.group_members gm
     WHERE gm.user_id = p.id AND public.is_group_member(gm.group_id)
   );

GRANT SELECT ON public.group_profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.task_comment_counts()
RETURNS TABLE (task_id uuid, comment_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.task_id, count(*)::bigint
  FROM public.task_comments c
  WHERE public.can_access_task(c.task_id)
  GROUP BY c.task_id;
$$;

REVOKE ALL ON FUNCTION public.task_comment_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_comment_counts() TO authenticated;

-- Handoff groups and reassign group tasks before auth.users is deleted.
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
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

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

  DELETE FROM public.group_members WHERE user_id = uid;

  UPDATE public.tasks t
  SET
    user_id = COALESCE(NULLIF(t.assignee_id, uid), g.created_by),
    created_by = COALESCE(NULLIF(t.created_by, uid), NULLIF(t.assignee_id, uid), g.created_by)
  FROM public.groups g
  WHERE t.group_id = g.id
    AND (t.user_id = uid OR t.created_by = uid);
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_account_deletion() TO authenticated;
