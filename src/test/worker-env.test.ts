import { describe, expect, it } from "vitest";

import { applyWorkerEnv } from "@/lib/worker-env";

describe("applyWorkerEnv", () => {
  it("copies string bindings and ignores assets objects", () => {
    const previous = process.env.SUPABASE_URL;
    applyWorkerEnv({
      SUPABASE_URL: "https://example.supabase.co",
      ASSETS: { fetch() {} },
    });
    expect(process.env.SUPABASE_URL).toBe("https://example.supabase.co");
    if (previous === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous;
  });
});
