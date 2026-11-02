import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

const ACCOUNT_LINKS = [
  { to: "/dashboard", label: "Painel", match: (path: string) => path === "/dashboard" },
  {
    to: "/groups",
    label: "Grupos",
    match: (path: string) => path.startsWith("/groups") || path.startsWith("/join"),
  },
  { to: "/account", label: "Conta", match: (path: string) => path === "/account" },
] as const;

function AccountNav({ pathname, onSignOut }: { pathname: string; onSignOut: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <NotificationBell />
      <ThemeToggle />
      <nav className="hidden items-center gap-1 md:flex" aria-label="Área da conta">
        {ACCOUNT_LINKS.map((item) => (
          <Button
            key={item.to}
            variant={item.match(pathname) ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            asChild
          >
            <Link to={item.to}>{item.label}</Link>
          </Button>
        ))}
        <Button variant="outline" size="sm" className="rounded-full" onClick={onSignOut}>
          Sair
        </Button>
      </nav>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-label="Abrir menu"
          >
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-72">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-2" aria-label="Área da conta">
            {ACCOUNT_LINKS.map((item) => (
              <SheetClose key={item.to} asChild>
                <Button
                  variant={item.match(pathname) ? "default" : "ghost"}
                  className="justify-start"
                  asChild
                >
                  <Link to={item.to}>{item.label}</Link>
                </Button>
              </SheetClose>
            ))}
            <SheetClose asChild>
              <Button variant="outline" className="justify-start" onClick={onSignOut}>
                Sair
              </Button>
            </SheetClose>
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}

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
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          {welcome ? (
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <Button variant="outline" onClick={signOut}>
                Sair
              </Button>
            </div>
          ) : (
            <AccountNav pathname={pathname} onSignOut={signOut} />
          )}
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Outlet />
      </div>
    </div>
  );
}
