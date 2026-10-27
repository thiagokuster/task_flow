import { describe, expect, it } from "vitest";

import { matchesScope } from "@/lib/task-filters";
import type { Task } from "@/lib/tasks";

function task(partial: Partial<Task>): Task {
  return {
    id: "t1",
    title: "X",
    description: "",
    priority: "medium",
    status: "pending",
    due_at: null,
    completed_at: null,
    project_id: null,
    category_id: null,
    created_at: "",
    updated_at: "",
    tag_ids: [],
    group_id: null,
    assignee_id: null,
    created_by: "me",
    user_id: "me",
    assignee_name: null,
    comment_count: 0,
    ...partial,
  };
}

describe("matchesScope", () => {
  it("treats personal tasks as mine", () => {
    expect(matchesScope(task({}), "mine", "me")).toBe(true);
    expect(matchesScope(task({}), "assigned_by_me", "me")).toBe(false);
    expect(matchesScope(task({}), "group_all", "me")).toBe(false);
  });

  it("keeps group tasks assigned to me under Minhas", () => {
    const shared = task({
      group_id: "g1",
      assignee_id: "me",
      created_by: "other",
      user_id: "other",
    });
    expect(matchesScope(shared, "mine", "me")).toBe(true);
    expect(matchesScope(shared, "assigned_by_me", "me")).toBe(false);
    expect(matchesScope(shared, "group_all", "me")).toBe(true);
  });

  it("lists group tasks I created under Atribuídas por mim", () => {
    const created = task({ group_id: "g1", assignee_id: "you", created_by: "me", user_id: "me" });
    expect(matchesScope(created, "assigned_by_me", "me")).toBe(true);
    expect(matchesScope(created, "mine", "me")).toBe(false);
  });
});
