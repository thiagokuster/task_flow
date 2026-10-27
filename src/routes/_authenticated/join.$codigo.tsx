import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { joinGroup, previewGroup } from "@/lib/groups";

export const Route = createFileRoute("/_authenticated/join/$codigo")({
  head: () => ({
    meta: [
      { title: "Entrar no grupo — TaskFlow" },
      { name: "description", content: "Aceite o convite para um grupo do TaskFlow." },
    ],
  }),
  component: JoinGroupPage,
});

function JoinGroupPage() {
  const { codigo } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const preview = useQuery({
    queryKey: ["group-preview", codigo],
    queryFn: () => previewGroup(codigo),
  });

  async function join() {
    setBusy(true);
    try {
      const id = await joinGroup(codigo);
      await qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Você entrou no grupo.");
      navigate({ to: "/groups/$groupId", params: { groupId: id } });
    } catch {
      toast.error("Convite inválido ou expirado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-md space-y-6 text-center">
      <span className="mx-auto inline-flex size-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-400">
        <Users className="size-8" aria-hidden />
      </span>
      {preview.isLoading ? (
        <p className="text-muted-foreground">Verificando convite…</p>
      ) : preview.data ? (
        <>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Entrar em {preview.data.name}?
          </h1>
          <p className="text-muted-foreground">
            Você vai ver as tarefas compartilhadas deste grupo.
          </p>
          <Button type="button" onClick={join} disabled={busy} className="w-full">
            {busy ? "Entrando…" : "Entrar no grupo"}
          </Button>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl font-bold tracking-tight">Convite inválido</h1>
          <p className="text-muted-foreground">Esse código não corresponde a um grupo ativo.</p>
        </>
      )}
      <Button variant="ghost" asChild>
        <Link to="/groups">Ver meus grupos</Link>
      </Button>
    </div>
  );
}
