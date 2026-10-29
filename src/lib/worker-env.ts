/** Copy Cloudflare Worker bindings onto process.env so SSR can read them. */
export function applyWorkerEnv(env: unknown) {
  if (!env || typeof env !== "object") return;
  for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
    if (typeof value === "string" && value.length > 0) {
      process.env[key] = value;
    }
  }
}
