import { describe, expect, it } from "vitest";

import { dueAtFromDateInput } from "@/lib/dates";
import {
  AUTH_UNREACHABLE_ERROR,
  commentSchema,
  friendlyAuthError,
  GROUP_TASK_EXTRAS_ERROR,
  signInSchema,
  signUpSchema,
  taskPatchSchema,
  taskSchema,
} from "@/lib/validation";

describe("signUpSchema", () => {
  const valid = {
    fullName: "Ana Silva",
    email: "ana@example.com",
    password: "SenhaForte12",
    confirm: "SenhaForte12",
    terms: true as const,
  };

  it("accepts a complete signup", () => {
    expect(signUpSchema.parse(valid).email).toBe("ana@example.com");
  });

  it("requires terms and a strong password", () => {
    expect(signUpSchema.safeParse({ ...valid, terms: false }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, password: "curta", confirm: "curta" }).success).toBe(
      false,
    );
  });
});

describe("friendlyAuthError", () => {
  it("explains network failures instead of a generic retry", () => {
    expect(friendlyAuthError("Failed to fetch")).toBe(AUTH_UNREACHABLE_ERROR);
    expect(friendlyAuthError("Unsupported provider: provider is not enabled")).toMatch(/Google/);
  });
});

describe("commentSchema", () => {
  it("requires a trimmed body up to 2000 characters", () => {
    expect(commentSchema.safeParse({ body: "  oi  " }).success).toBe(true);
    expect(commentSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(commentSchema.safeParse({ body: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("taskSchema due dates", () => {
  const base = {
    title: "Comprar pão",
    description: "",
    priority: "medium" as const,
    status: "pending" as const,
    project_id: null,
    category_id: null,
    group_id: null,
    assignee_id: null,
    tag_ids: [],
  };

  it("rejects a due date in the past", () => {
    expect(taskSchema.safeParse({ ...base, due_at: dueAtFromDateInput("2002-01-01") }).success).toBe(
      false,
    );
  });

  it("allows omitting due_at on a patch", () => {
    expect(taskPatchSchema.safeParse({ status: "done" }).success).toBe(true);
  });

  it("rejects project, category and tags on a group task", () => {
    const group = { ...base, group_id: "11111111-1111-4111-8111-111111111111", due_at: null };
    expect(taskSchema.safeParse(group).success).toBe(true);
    expect(taskSchema.safeParse({ ...group, project_id: group.group_id }).success).toBe(false);
    expect(taskSchema.safeParse({ ...group, tag_ids: [group.group_id] }).error?.issues[0]?.message).toBe(
      GROUP_TASK_EXTRAS_ERROR,
    );
  });
});

describe("signInSchema", () => {
  it("requires an email and a password", () => {
    expect(signInSchema.safeParse({ email: "", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
});
