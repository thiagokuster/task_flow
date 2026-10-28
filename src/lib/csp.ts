/** Per-request nonce so inline scripts (theme boot, hydration) do not need 'unsafe-inline'. */
export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function defaultSupabaseUrl(): string {
  const vite = import.meta.env["VITE_SUPABASE_URL"];
  if (typeof vite === "string" && vite.length) return vite;
  const server = typeof process !== "undefined" ? process.env["SUPABASE_URL"] : undefined;
  return typeof server === "string" ? server : "";
}

/** https + websocket origins for the configured backend (hosted or self-hosted). */
export function supabaseConnectSources(rawUrl = defaultSupabaseUrl()): string[] {
  try {
    const url = new URL(rawUrl);
    const http = `${url.protocol}//${url.host}`;
    const ws = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`;
    const hosted = url.host === "supabase.co" || url.host.endsWith(".supabase.co");
    return hosted ? [http, ws, "https://*.supabase.co", "wss://*.supabase.co"] : [http, ws];
  } catch {
    return ["https://*.supabase.co", "wss://*.supabase.co"];
  }
}

export function contentSecurityPolicy(nonce: string, supabaseUrl?: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${supabaseConnectSources(supabaseUrl).join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/** Stamp every <script> so the nonce in CSP matches the document. */
export function applyScriptNonces(html: string, nonce: string): string {
  return html.replace(/<script\b(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);
}

/**
 * Rewrite <script> tags as HTML chunks arrive so SSR can keep streaming.
 * Holds bytes after a trailing '<' until the tag closes, so a split <script> is not missed.
 */
export function stampHtmlScriptNonces(
  body: ReadableStream<Uint8Array>,
  nonce: string,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let leftover = "";
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const text = leftover + decoder.decode(chunk, { stream: true });
        const lastLt = text.lastIndexOf("<");
        if (lastLt >= 0 && text.indexOf(">", lastLt) === -1) {
          leftover = text.slice(lastLt);
          const ready = text.slice(0, lastLt);
          if (ready) controller.enqueue(encoder.encode(applyScriptNonces(ready, nonce)));
          return;
        }
        leftover = "";
        controller.enqueue(encoder.encode(applyScriptNonces(text, nonce)));
      },
      flush(controller) {
        leftover += decoder.decode();
        if (leftover) controller.enqueue(encoder.encode(applyScriptNonces(leftover, nonce)));
      },
    }),
  );
}
