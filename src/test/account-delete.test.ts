import { describe, expect, it } from "vitest";

import { planOwnedGroupHandoff } from "@/lib/account-delete";

describe("planOwnedGroupHandoff", () => {
  it("deletes a group when the owner is the only member", () => {
    const plan = planOwnedGroupHandoff("owner-1", [
      { group_id: "g1", user_id: "owner-1", role: "owner", joined_at: "2026-01-01T00:00:00Z" },
    ]);
    expect(plan.deleteGroupIds).toEqual(["g1"]);
    expect(plan.transfers).toEqual([]);
  });

  it("hands the group to the earliest remaining member", () => {
    const plan = planOwnedGroupHandoff("owner-1", [
      { group_id: "g1", user_id: "owner-1", role: "owner", joined_at: "2026-01-01T00:00:00Z" },
      { group_id: "g1", user_id: "b", role: "member", joined_at: "2026-02-01T00:00:00Z" },
      { group_id: "g1", user_id: "a", role: "member", joined_at: "2026-01-15T00:00:00Z" },
    ]);
    expect(plan.deleteGroupIds).toEqual([]);
    expect(plan.transfers).toEqual([{ groupId: "g1", successorId: "a" }]);
  });

  it("ignores groups the user does not own", () => {
    const plan = planOwnedGroupHandoff("member-1", [
      { group_id: "g1", user_id: "owner-1", role: "owner", joined_at: "2026-01-01T00:00:00Z" },
      { group_id: "g1", user_id: "member-1", role: "member", joined_at: "2026-01-02T00:00:00Z" },
    ]);
    expect(plan.deleteGroupIds).toEqual([]);
    expect(plan.transfers).toEqual([]);
  });
});
