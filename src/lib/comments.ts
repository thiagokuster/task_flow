import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string;
};

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export const taskCommentsQuery = (taskId: string) =>
  queryOptions({
    queryKey: ["task-comments", taskId],
    queryFn: async (): Promise<TaskComment[]> => {
      const { data, error } = await supabase
        .from("task_comments")
        .select(
          "id,task_id,author_id,body,created_at,author:profiles!task_comments_author_id_fkey(full_name)",
        )
        .eq("task_id", taskId)
        .order("created_at", { ascending: true })
        .limit(200);
      fail(error);
      return (data ?? []).map((row) => {
        const author = row.author as { full_name: string } | { full_name: string }[] | null;
        const profile = Array.isArray(author) ? author[0] : author;
        return {
          id: row.id,
          task_id: row.task_id,
          author_id: row.author_id,
          body: row.body,
          created_at: row.created_at,
          author_name: profile?.full_name ?? "",
        };
      });
    },
  });

export async function createComment(taskId: string, body: string) {
  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    body: body.trim(),
  });
  fail(error);
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from("task_comments").delete().eq("id", id);
  fail(error);
}
