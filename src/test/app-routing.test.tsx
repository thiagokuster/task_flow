import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("matches auth, account and welcome routes", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    expect(router.matchRoutes("/auth").at(-1)?.routeId).toBe("/auth");
    expect(router.matchRoutes("/account").at(-1)?.routeId).toBe("/_authenticated/account");
    expect(router.matchRoutes("/welcome").at(-1)?.routeId).toBe("/_authenticated/welcome");
    expect(router.matchRoutes("/groups").at(-1)?.routeId).toBe("/_authenticated/groups/");
    expect(router.matchRoutes("/join/ABC12345").at(-1)?.routeId).toBe(
      "/_authenticated/join/$codigo",
    );
    expect(router.matchRoutes("/callback").at(-1)?.routeId).toBe("/callback");
  });
});
