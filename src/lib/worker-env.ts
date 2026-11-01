function setEnv(name: string, value: string | undefined) {
  if (value) process.env[name] = value;
}

/** Copy Cloudflare Worker bindings onto process.env so SSR can read them. */
export function applyWorkerEnv(env: unknown) {
  if (!env || typeof env !== "object") return;
  for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
    if (typeof value === "string" && value.length > 0) {
      process.env[key] = value;
    }
  }
  setEnv("SUPABASE_URL", process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]);
  setEnv(
    "SUPABASE_PUBLISHABLE_KEY",
    process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
  );
}
