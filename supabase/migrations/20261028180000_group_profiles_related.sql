-- group_profiles used to start from every profiles row and probe membership
-- per id. With security_barrier the caller's WHERE id IN (...) cannot push
-- down, so a lookup of unrelated ids scanned the whole table (~1 s for 400).
-- Build the visible set from the caller's groups and accessible tasks first.

CREATE OR REPLACE VIEW public.group_profiles
WITH (security_invoker = false, security_barrier = true) AS
WITH my_groups AS (
  SELECT group_id
  FROM public.group_members
  WHERE user_id = auth.uid()
),
accessible_tasks AS (
  SELECT t.id, t.created_by, t.assignee_id
  FROM public.tasks t
  WHERE t.user_id = auth.uid()
     OR t.group_id IN (SELECT group_id FROM my_groups)
),
visible AS (
  SELECT auth.uid() AS id
  WHERE auth.uid() IS NOT NULL
  UNION
  SELECT gm.user_id
  FROM my_groups g
  JOIN public.group_members gm ON gm.group_id = g.group_id
  UNION
  SELECT c.author_id
  FROM accessible_tasks t
  JOIN public.task_comments c ON c.task_id = t.id
  UNION
  SELECT created_by FROM accessible_tasks WHERE created_by IS NOT NULL
  UNION
  SELECT assignee_id FROM accessible_tasks WHERE assignee_id IS NOT NULL
)
SELECT p.id, p.full_name
FROM public.profiles p
JOIN visible v ON v.id = p.id;

REVOKE ALL ON public.group_profiles FROM PUBLIC;
REVOKE ALL ON public.group_profiles FROM anon;
GRANT SELECT ON public.group_profiles TO authenticated;
GRANT ALL ON public.group_profiles TO service_role;
