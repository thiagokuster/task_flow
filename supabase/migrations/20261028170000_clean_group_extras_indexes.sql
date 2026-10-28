-- Unstick group tasks that still have personal project/category/tags from
-- before the reject trigger, and index the columns group_profiles scans.

CREATE OR REPLACE FUNCTION public.force_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public._account_deletion_in_progress() THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.user_id = auth.uid();
    ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'owner cannot change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.force_owner() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM set_config('app.account_deletion', 'on', true);

  DELETE FROM public.task_tags tt
  USING public.tasks t
  WHERE tt.task_id = t.id AND t.group_id IS NOT NULL;

  UPDATE public.tasks
  SET project_id = NULL, category_id = NULL
  WHERE group_id IS NOT NULL
    AND (project_id IS NOT NULL OR category_id IS NOT NULL);
END $$;

CREATE INDEX IF NOT EXISTS tasks_created_by_idx ON public.tasks (created_by);
CREATE INDEX IF NOT EXISTS task_comments_author_idx ON public.task_comments (author_id);
