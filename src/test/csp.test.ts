import { describe, expect, it } from "vitest";

import {
  applyScriptNonces,
  contentSecurityPolicy,
  createCspNonce,
  stampHtmlScriptNonces,
  supabaseConnectSources,
} from "@/lib/csp";
import { renderErrorPage } from "@/lib/error-page";

describe("CSP nonce", () => {
  it("issues a unique nonce and drops script-src unsafe-inline", () => {
    const nonce = createCspNonce();
    const policy = contentSecurityPolicy(nonce, "https://abc.supabase.co");
    expect(nonce.length).toBeGreaterThan(10);
    expect(createCspNonce()).not.toBe(nonce);
    expect(policy).toContain(`script-src 'nonce-${nonce}' 'strict-dynamic'`);
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("stamps script tags that Vite and the theme boot emit", () => {
    const html = applyScriptNonces(
      `<html><head><script>window.__theme="dark"</script><script type="module" src="/assets/app.js"></script></head></html>`,
      "abc123",
    );
    expect(html).toContain('<script nonce="abc123">window.__theme="dark"</script>');
    expect(html).toContain('<script nonce="abc123" type="module" src="/assets/app.js">');
  });

  it("does not rely on inline event handlers in the error page", () => {
    expect(renderErrorPage()).not.toMatch(/\son\w+\s*=/i);
  });

  it("keeps streaming when a <script> tag is split across chunks", async () => {
    const stream = stampHtmlScriptNonces(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`<html><head><scr`));
          controller.enqueue(new TextEncoder().encode(`ipt src="/app.js"></script></head></html>`));
          controller.close();
        },
      }),
      "n1",
    );
    const html = await new Response(stream).text();
    expect(html).toContain('<script nonce="n1" src="/app.js"></script>');
  });
});

describe("supabaseConnectSources", () => {
  it("uses the configured host so custom domains and self-hosted work", () => {
    expect(supabaseConnectSources("https://db.empresa.internal")).toEqual([
      "https://db.empresa.internal",
      "wss://db.empresa.internal",
    ]);
  });

  it("keeps the hosted wildcard when the project is on supabase.co", () => {
    expect(supabaseConnectSources("https://abc.supabase.co")).toEqual([
      "https://abc.supabase.co",
      "wss://abc.supabase.co",
      "https://*.supabase.co",
      "wss://*.supabase.co",
    ]);
  });
});
