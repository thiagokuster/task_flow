import { describe, expect, it } from "vitest";

import { inviteErrorMessage } from "@/lib/groups";

describe("inviteErrorMessage", () => {
  it("explains expiry, rate limits and invalid codes", () => {
    expect(inviteErrorMessage({ message: "invite expired" })).toMatch(/expirou/i);
    expect(inviteErrorMessage("expired")).toMatch(/expirou/i);
    expect(inviteErrorMessage({ message: "too many invite attempts" })).toMatch(/tentativas/i);
    expect(inviteErrorMessage("rate_limited")).toMatch(/tentativas/i);
    expect(inviteErrorMessage({ message: "invalid invite" })).toMatch(/inválido/i);
    expect(inviteErrorMessage("invalid")).toMatch(/inválido/i);
  });
});
