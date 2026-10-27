import { describe, expect, it } from "vitest";

import { applyScriptNonces, contentSecurityPolicy, createCspNonce } from "@/lib/csp";
import { renderErrorPage } from "@/lib/error-page";

describe("CSP nonce", () => {
  it("issues a unique nonce and drops script-src unsafe-inline", () => {
    const nonce = createCspNonce();
    const policy = contentSecurityPolicy(nonce);
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
});
