import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TaskInput, TaskPriority, TaskStatus } from "./validation";

// All reads/writes go through the user's session; Row-Level Security in the
// database is what actually enforces ownership. user_id is never sent from the client.

export type Task = {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  completed_at: string | null;
  project_id: string | null;
  category_id: string | null;
  group_id: string | null;
  assignee_id: string | null;
  created_by: string;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
  tag_ids: string[];
  user_id: string;
  comment_count: number;
};
export type Named = { id: string; name: string; color?: string };

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function loadCommentCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("task_comments").select("task_id");
  if (error || !data) return new Map();
  const counts = new Map<string, number>();
  for (const row of data) {
    counts.set(row.task_id, (counts.get(row.task_id) ?? 0) + 1);
  }
  return counts;
}

export const tasksQuery = queryOptions({
  queryKey: ["tasks"],
  queryFn: async (): Promise<Task[]> => {
    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id,title,description,priority,status,due_at,completed_at,project_id,category_id,created_at,updated_at,user_id,group_id,assignee_id,created_by,task_tags(tag_id),assignee:profiles!tasks_assignee_id_fkey(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(2000);
    fail(error);
    const commentCounts = await loadCommentCounts();
    return (data ?? []).map((row) => {
      const { task_tags, assignee, ...t } = row as typeof row & {
        assignee: { full_name: string } | { full_name: string }[] | null;
      };
      const profile = Array.isArray(assignee) ? assignee[0] : assignee;
      return {
        ...(t as Omit<Task, "tag_ids" | "assignee_name" | "comment_count">),
        tag_ids: (task_tags ?? []).map((x) => x.tag_id),
        assignee_name: profile?.full_name ?? null,
        comment_count: commentCounts.get(t.id) ?? 0,
      };
    });
  },
});

export const projectsQuery = queryOptions({
  queryKey: ["projects"],
  queryFn: async (): Promise<Named[]> => {
    const { data, error } = await supabase.from("projects").select("id,name,color").order("name");
    fail(error);
    return data ?? [];
  },
});
export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async (): Promise<Named[]> => {
    const { data, error } = await supabase.from("categories").select("id,name").order("name");
    fail(error);
    return data ?? [];
  },
});
export const tagsQuery = queryOptions({
  queryKey: ["tags"],
  queryFn: async (): Promise<Named[]> => {
    const { data, error } = await supabase.from("tags").select("id,name").order("name");
    fail(error);
    return data ?? [];
  },
});

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("not authenticated");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", u.user.id)
      .maybeSingle();
    fail(error);
    return { profile: data, user: u.user };
  },
});

export type AppNotification = {
  id: string;
  task_id: string | null;
  kind: string;
  message: string;
  read_at: string | null;
  created_at: string;
};

export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: async (): Promise<AppNotification[]> => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id,task_id,kind,message,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    fail(error);
    return data ?? [];
  },
});

export async function refreshDeadlineNotifications() {
  await supabase.rpc("refresh_my_notifications");
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  fail(error);
}

export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  fail(error);
}

export const auditQuery = queryOptions({
  queryKey: ["audit"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("audit_events")
      .select("id,event,created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    fail(error);
    return data ?? [];
  },
});

async function setTags(taskId: string, tagIds: string[]) {
  const { error: delErr } = await supabase.from("task_tags").delete().eq("task_id", taskId);
  fail(delErr);
  if (tagIds.length) {
    // user_id is filled by the database from the session (force_owner trigger)
    const rows = tagIds.map((tag_id) => ({ task_id: taskId, tag_id })) as never;
    const { error } = await supabase.from("task_tags").insert(rows);
    fail(error);
  }
}

export async function createTask(input: TaskInput) {
  const { tag_ids, ...rest } = input;
  const { data, error } = await supabase
    .from("tasks")
    .insert(rest as never)
    .select("id")
    .single();
  fail(error);
  await setTags(data!.id, tag_ids);
  return data!.id;
}

export async function updateTask(id: string, input: Partial<TaskInput>) {
  const { tag_ids, ...rest } = input;
  if (Object.keys(rest).length) {
    const { error } = await supabase.from("tasks").update(rest).eq("id", id);
    fail(error);
  }
  if (tag_ids) await setTags(id, tag_ids);
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  fail(error);
}

export async function createNamed(table: "projects" | "categories" | "tags", name: string) {
  const { error } = await supabase.from(table).insert({ name } as never);
  if (error?.code === "23505") throw new Error("Já existe um item com esse nome.");
  fail(error);
}
export async function deleteNamed(table: "projects" | "categories" | "tags", id: string) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  fail(error);
}

export function isOverdue(t: Pick<Task, "due_at" | "status">, now = Date.now()) {
  return (
    !!t.due_at &&
    (t.status === "pending" || t.status === "in_progress") &&
    new Date(t.due_at).getTime() < now
  );
}
