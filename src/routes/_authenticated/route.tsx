import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSync } from "@/lib/realtime";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      const next = location.pathname.startsWith("/") ? location.pathname : "/dashboard";
      throw redirect({ to: "/auth", search: { mode: "signin", redirect: next } });
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("terms_accepted_at")
      .eq("id", data.user.id)
      .maybeSingle();
    const onWelcome = location.pathname === "/welcome";
    if (!profile?.terms_accepted_at && !onWelcome) {
      throw redirect({ to: "/welcome" });
    }
    if (profile?.terms_accepted_at && onWelcome) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const welcome = pathname === "/welcome";
  useRealtimeSync();

  async function signOut() {
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-6 py-3">
          <Logo />
          {welcome ? (
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="outline" onClick={signOut}>
                Sair
              </Button>
            </div>
          ) : (
            <nav className="flex items-center gap-1" aria-label="Área da conta">
              <Button
                variant={pathname === "/dashboard" ? "default" : "ghost"}
                size="sm"
                className="rounded-full"
                asChild
              >
                <Link to="/dashboard">Painel</Link>
              </Button>
              <Button
                variant={
                  pathname.startsWith("/groups") || pathname.startsWith("/join")
                    ? "default"
                    : "ghost"
                }
                size="sm"
                className="rounded-full"
                asChild
              >
                <Link to="/groups">Grupos</Link>
              </Button>
              <Button
                variant={pathname === "/account" ? "default" : "ghost"}
                size="sm"
                className="rounded-full"
                asChild
              >
                <Link to="/account">Conta</Link>
              </Button>
              <NotificationBell />
              <ThemeToggle />
              <Button variant="outline" size="sm" className="rounded-full" onClick={signOut}>
                Sair
              </Button>
            </nav>
          )}
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Outlet />
      </div>
    </div>
  );
}
