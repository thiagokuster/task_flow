export type AuthProbe = {
  reachable: boolean;
  google: boolean;
};

function supabaseUrl(): string | undefined {
  const value = import.meta.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  return typeof value === "string" && value.length > 0 ? value.replace(/\/+$/, "") : undefined;
}

function supabaseKey(): string | undefined {
  const value =
    import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Checks that Auth is reachable before a full-page OAuth redirect. */
export async function probeSupabaseAuth(): Promise<AuthProbe> {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url) return { reachable: false, google: false };

  const headers: HeadersInit = key ? { apikey: key } : {};
  try {
    const health = await fetch(`${url}/auth/v1/health`, { method: "GET", headers });
    if (!health.ok) return { reachable: false, google: false };

    if (!key) return { reachable: true, google: false };
    const settings = await fetch(`${url}/auth/v1/settings`, { method: "GET", headers });
    if (!settings.ok) return { reachable: true, google: false };
    const body = (await settings.json()) as { external?: { google?: unknown } };
    return { reachable: true, google: body.external?.google === true };
  } catch {
    return { reachable: false, google: false };
  }
}
