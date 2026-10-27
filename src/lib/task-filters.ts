import type { Task } from "@/lib/tasks";

export type TaskScope = "mine" | "assigned_by_me" | "group_all";

export const TASK_SCOPES: { id: TaskScope; label: string }[] = [
  { id: "mine", label: "Minhas" },
  { id: "assigned_by_me", label: "Atribuídas por mim" },
  { id: "group_all", label: "Todas do grupo" },
];

/** Personal tasks plus group tasks assigned to the current user. */
export function matchesScope(task: Task, scope: TaskScope, userId: string): boolean {
  if (scope === "mine") {
    if (!task.group_id) return task.user_id === userId || task.created_by === userId;
    return task.assignee_id === userId;
  }
  if (scope === "assigned_by_me") {
    return task.group_id != null && task.created_by === userId;
  }
  return task.group_id != null;
}
