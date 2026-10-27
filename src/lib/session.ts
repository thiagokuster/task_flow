import { supabase } from "@/integrations/supabase/client";

// "Lembrar de mim": when unchecked, the session lasts only while the browser is open.
const EPHEMERAL_KEY = "tf_ephemeral";
const ALIVE_KEY = "tf_alive";

export function markSessionPersistence(remember: boolean) {
  if (typeof window === "undefined") return;
  if (remember) {
    localStorage.removeItem(EPHEMERAL_KEY);
  } else {
    localStorage.setItem(EPHEMERAL_KEY, "1");
  }
  sessionStorage.setItem(ALIVE_KEY, "1");
}

/** Called once at app start: ends sessions that should not survive a browser restart. */
export async function enforceSessionPersistence() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(EPHEMERAL_KEY) === "1" && sessionStorage.getItem(ALIVE_KEY) !== "1") {
    localStorage.removeItem(EPHEMERAL_KEY);
    await supabase.auth.signOut({ scope: "local" });
  }
  sessionStorage.setItem(ALIVE_KEY, "1");
}

export async function logEvent(event: string) {
  try {
    await supabase.rpc("log_security_event", { _event: event });
  } catch {
    // audit logging must never block the user flow
  }
}

/** Records LGPD/terms acceptance on the caller's profile. */
export async function acceptTerms(): Promise<void> {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) throw new Error("not authenticated");
  const now = new Date().toISOString();
  const meta = data.user.user_metadata;
  const rawName = meta["full_name"] ?? meta["name"];
  const full_name = typeof rawName === "string" ? rawName.slice(0, 120) : "";
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: data.user.id, full_name, terms_accepted_at: now }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

/** Only allow same-origin relative paths as post-login destinations. */
export function safeRedirect(path: unknown, fallback = "/dashboard"): string {
  if (typeof path !== "string") return fallback;
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}

const POST_LOGIN_REDIRECT_KEY = "tf_post_login_redirect";

export function rememberPostLoginRedirect(path: unknown) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, safeRedirect(path));
}

export function takePostLoginRedirect(): string {
  if (typeof window === "undefined") return "/dashboard";
  const raw = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  return safeRedirect(raw);
}

export const REAUTH_MAX_AGE_SEC = 600;
export const REAUTH_REQUIRED_ERROR =
  "Por segurança, entre de novo na sua conta e depois confirme a exclusão.";

type AuthMethod = { method?: string; timestamp?: number };

/** Latest password/OAuth authentication time from AMR — not the JWT refresh `iat`. */
export function latestAuthAt(claims: { amr?: AuthMethod[] | null }): number {
  const stamps = (claims.amr ?? [])
    .map((entry) => entry.timestamp)
    .filter((value): value is number => typeof value === "number" && value > 0);
  if (stamps.length === 0) return 0;
  return Math.max(...stamps);
}

export function needsReauth(claims: { amr?: AuthMethod[] | null }, nowSec = Date.now() / 1000): boolean {
  const at = latestAuthAt(claims);
  return !at || nowSec - at > REAUTH_MAX_AGE_SEC;
}

// Simple client-side cooldown to discourage rapid repeated attempts.
// Real enforcement is done server-side by the authentication service's rate limits.
const attempts = new Map<string, number[]>();
export function clientThrottle(key: string, max = 5, windowMs = 60_000): number {
  const now = Date.now();
  const list = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) return Math.ceil((windowMs - (now - (list[0] ?? now))) / 1000);
  list.push(now);
  attempts.set(key, list);
  return 0;
}
