import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptTerms } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({
    meta: [
      { title: "Aceite os termos — TaskFlow" },
      { name: "description", content: "Confirme os termos de uso para continuar." },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      toast.error("Aceite os termos para continuar.");
      return;
    }
    setBusy(true);
    try {
      await acceptTerms();
      navigate({ to: "/dashboard", replace: true });
    } catch {
      toast.error("Não foi possível registrar o aceite agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-16 max-w-md space-y-6">
      <h1 className="text-3xl font-bold">Antes de continuar</h1>
      <p className="text-muted-foreground">
        Contas criadas com Google também precisam aceitar os termos de uso e a política de
        privacidade.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
        />
        <span>
          Aceito os{" "}
          <Link to="/terms" className="underline">
            termos
          </Link>{" "}
          e a{" "}
          <Link to="/privacy" className="underline">
            política de privacidade
          </Link>
          {"."}
        </span>
      </label>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Aguarde…" : "Continuar para o painel"}
      </Button>
    </form>
  );
}
