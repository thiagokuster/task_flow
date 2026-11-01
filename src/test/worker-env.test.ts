import { describe, expect, it } from "vitest";

import { applyWorkerEnv } from "@/lib/worker-env";

function restore(name: string, previous: string | undefined) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

describe("applyWorkerEnv", () => {
  it("copies string bindings and ignores assets objects", () => {
    const previous = process.env["SUPABASE_URL"];
    applyWorkerEnv({
      SUPABASE_URL: "https://example.supabase.co",
      ASSETS: { fetch() {} },
    });
    expect(process.env["SUPABASE_URL"]).toBe("https://example.supabase.co");
    restore("SUPABASE_URL", previous);
  });

  it("aliases public Vite keys onto the server names", () => {
    const previousUrl = process.env["SUPABASE_URL"];
    const previousKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    delete process.env["SUPABASE_URL"];
    delete process.env["SUPABASE_PUBLISHABLE_KEY"];
    applyWorkerEnv({
      VITE_SUPABASE_URL: "https://from-vite.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    expect(process.env["SUPABASE_URL"]).toBe("https://from-vite.supabase.co");
    expect(process.env["SUPABASE_PUBLISHABLE_KEY"]).toBe("sb_publishable_test");
    restore("SUPABASE_URL", previousUrl);
    restore("SUPABASE_PUBLISHABLE_KEY", previousKey);
  });
});
