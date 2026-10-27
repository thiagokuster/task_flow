import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { takePostLoginRedirect } from "@/lib/session";

export const Route = createFileRoute("/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Concluindo login — TaskFlow" },
      { name: "description", content: "Finalizando o acesso com Google." },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error_description") || params.get("error");
    if (oauthError) {
      setError("Não foi possível entrar com Google. Tente novamente.");
      return;
    }

    const next = takePostLoginRedirect() as "/dashboard";

    async function finish() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        navigate({ to: next, replace: true });
      }
    }

    void finish();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        navigate({ to: next, replace: true });
      }
    });
    const timeout = window.setTimeout(() => {
      if (!cancelled) setError("Não foi possível concluir o login. Tente entrar de novo.");
    }, 12_000);

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [navigate]);

  if (error) {
    return (
      <AuthShell title="Login não concluído" subtitle={error}>
        <Button asChild className="w-full">
          <Link to="/auth" search={{ mode: "signin" }}>
            Voltar ao login
          </Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Concluindo login" subtitle="Aguarde enquanto confirmamos sua sessão.">
      <p className="text-center text-sm text-muted-foreground" role="status">
        Autenticando…
      </p>
    </AuthShell>
  );
}
