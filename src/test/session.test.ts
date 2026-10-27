import { describe, expect, it } from "vitest";

import { clientThrottle, safeRedirect } from "@/lib/session";

describe("safeRedirect", () => {
  it("allows same-origin relative paths", () => {
    expect(safeRedirect("/dashboard")).toBe("/dashboard");
    expect(safeRedirect("/account?x=1")).toBe("/account?x=1");
  });

  it("rejects absolute URLs and protocol-relative paths", () => {
    expect(safeRedirect("https://evil.example/phish")).toBe("/dashboard");
    expect(safeRedirect("//evil.example")).toBe("/dashboard");
    expect(safeRedirect("/\\evil")).toBe("/dashboard");
    expect(safeRedirect("dashboard")).toBe("/dashboard");
  });

  it("falls back for non-strings", () => {
    expect(safeRedirect(undefined)).toBe("/dashboard");
    expect(safeRedirect(null)).toBe("/dashboard");
  });
});

describe("clientThrottle", () => {
  it("blocks after the max attempts in the window", () => {
    const key = `throttle-${Math.random()}`;
    expect(clientThrottle(key, 2, 60_000)).toBe(0);
    expect(clientThrottle(key, 2, 60_000)).toBe(0);
    expect(clientThrottle(key, 2, 60_000)).toBeGreaterThan(0);
  });
});
