import { supabase } from "@/integrations/supabase/client";

export function profileNameMap(
  rows: { id: string; full_name: string | null }[] | null | undefined,
): Map<string, string> {
  const names = new Map<string, string>();
  for (const row of rows ?? []) {
    if (row.full_name) names.set(row.id, row.full_name);
  }
  return names;
}

/** id + full_name for the caller, current group peers, and people still visible on shared tasks/comments. */
export async function loadGroupProfileNames(
  ids: Iterable<string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = [...new Set([...ids].filter((id): id is string => !!id))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase.from("group_profiles").select("id,full_name").in("id", unique);
  if (error || !data) return new Map();
  return profileNameMap(data);
}
