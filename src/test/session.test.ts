import { describe, expect, it } from "vitest";

import { clientThrottle, latestAuthAt, needsReauth, safeRedirect } from "@/lib/session";

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

describe("needsReauth", () => {
  it("requires AMR timestamps, not a refreshed JWT iat", () => {
    expect(latestAuthAt({})).toBe(0);
    expect(needsReauth({}, 1_700_000_000)).toBe(true);
    expect(needsReauth({ amr: [{ method: "password", timestamp: 1_700_000_000 }] }, 1_700_000_100)).toBe(
      false,
    );
    expect(needsReauth({ amr: [{ method: "password", timestamp: 1_700_000_000 }] }, 1_700_001_000)).toBe(
      true,
    );
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
