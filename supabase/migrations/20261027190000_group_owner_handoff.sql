-- Keep every group with an owner and created_by in sync, so leaving or
-- deleting an account cannot strand a group or block LGPD deletion.

-- Repair groups that already lost their owner.
WITH ranked AS (
  SELECT
    gm.group_id,
    gm.user_id,
    row_number() OVER (PARTITION BY gm.group_id ORDER BY gm.joined_at, gm.user_id) AS rn
  FROM public.group_members gm
  WHERE NOT EXISTS (
    SELECT 1 FROM public.group_members o
    WHERE o.group_id = gm.group_id AND o.role = 'owner'
  )
)
UPDATE public.group_members gm
SET role = 'owner'
FROM ranked r
WHERE gm.group_id = r.group_id AND gm.user_id = r.user_id AND r.rn = 1;

UPDATE public.groups g
SET created_by = m.user_id, updated_at = now()
FROM public.group_members m
WHERE m.group_id = g.id AND m.role = 'owner' AND g.created_by IS DISTINCT FROM m.user_id;

DELETE FROM public.groups g
WHERE NOT EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = g.id);

CREATE OR REPLACE FUNCTION public.group_members_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE successor uuid;
DECLARE remaining int;
BEGIN
  IF OLD.role IS DISTINCT FROM 'owner' THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO remaining
  FROM public.group_members
  WHERE group_id = OLD.group_id AND user_id IS DISTINCT FROM OLD.user_id;

  IF remaining = 0 THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = OLD.group_id
      AND user_id IS DISTINCT FROM OLD.user_id
      AND role = 'owner'
  ) THEN
    RETURN OLD;
  END IF;

  SELECT user_id INTO successor
  FROM public.group_members
  WHERE group_id = OLD.group_id AND user_id IS DISTINCT FROM OLD.user_id
  ORDER BY joined_at, user_id
  LIMIT 1;

  UPDATE public.group_members
  SET role = 'owner'
  WHERE group_id = OLD.group_id AND user_id = successor;

  UPDATE public.groups
  SET created_by = successor, updated_at = now()
  WHERE id = OLD.group_id;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.group_members_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = OLD.group_id) THEN
    DELETE FROM public.groups WHERE id = OLD.group_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS group_members_before_delete ON public.group_members;
CREATE TRIGGER group_members_before_delete
  BEFORE DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.group_members_before_delete();

DROP TRIGGER IF EXISTS group_members_after_delete ON public.group_members;
CREATE TRIGGER group_members_after_delete
  AFTER DELETE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.group_members_after_delete();

REVOKE ALL ON FUNCTION public.group_members_before_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.group_members_after_delete() FROM PUBLIC, anon, authenticated;
