-- Repair group creation: invite code permission + INSERT RLS + owner membership.

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

CREATE OR REPLACE FUNCTION public.create_group(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE gid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF char_length(btrim(_name)) < 1 OR char_length(btrim(_name)) > 80 THEN
    RAISE EXCEPTION 'invalid name';
  END IF;
  INSERT INTO public.groups (name, created_by)
  VALUES (btrim(_name), auth.uid())
  RETURNING id INTO gid;
  RETURN gid;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.groups_before_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.groups_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_group(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_group(text) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.group_members TO authenticated;

DROP POLICY IF EXISTS "groups_insert_own" ON public.groups;
CREATE POLICY "groups_insert_own" ON public.groups
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
