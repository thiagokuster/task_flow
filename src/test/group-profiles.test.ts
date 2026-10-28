import { describe, expect, it } from "vitest";

import { profileNameMap } from "@/lib/group-profiles";

describe("profileNameMap", () => {
  it("indexes colleague names by id and ignores empty names", () => {
    const names = profileNameMap([
      { id: "a", full_name: "Ana" },
      { id: "b", full_name: "" },
      { id: "c", full_name: "Bia" },
    ]);
    expect(names.get("a")).toBe("Ana");
    expect(names.has("b")).toBe(false);
    expect(names.get("c")).toBe("Bia");
  });
});
