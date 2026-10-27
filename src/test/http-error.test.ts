import { describe, expect, it } from "vitest";

import { isUnauthorizedError, unauthorized } from "@/lib/http-error";

describe("unauthorized", () => {
  it("marks generated errors as 401", () => {
    const error = unauthorized("Unauthorized: Invalid token");
    expect(error.statusCode).toBe(401);
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it("treats generated auth middleware Errors as unauthorized", () => {
    expect(isUnauthorizedError(new Error("Unauthorized: No token provided"))).toBe(true);
    expect(isUnauthorizedError(new Error("boom"))).toBe(false);
  });
});
