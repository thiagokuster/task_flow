import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createGroup, groupsQuery } from "@/lib/groups";

export const Route = createFileRoute("/_authenticated/groups/")({
  head: () => ({
    meta: [
      { title: "Grupos — TaskFlow" },
      { name: "description", content: "Grupos para tarefas compartilhadas." },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const qc = useQueryClient();
  const { data: groups = [], isLoading, isError } = useQuery(groupsQuery);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      await createGroup(n);
      setName("");
      await qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Grupo criado.");
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : "";
      toast.error(
        message.includes("permission denied") ||
          message.includes("row-level security") ||
          message.includes("could not find the function") ||
          message.includes("schema cache")
          ? "Falta uma correção no banco. Cole o SQL de grupos no Editor SQL do Supabase."
          : "Não foi possível criar o grupo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Grupos</h1>
        <p className="mt-1 text-muted-foreground">
          Compartilhe tarefas com outras pessoas. Cada grupo tem um link de convite.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-soft sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <Label htmlFor="group-name">Novo grupo</Label>
          <Input
            id="group-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do grupo"
            className="mt-1.5"
          />
        </div>
        <Button type="submit" disabled={busy || !name.trim()} className="shrink-0">
          <Plus />
          Criar grupo
        </Button>
      </form>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar os grupos. Confira se as migrations foram aplicadas no Supabase.
        </p>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/50 px-6 py-16 text-center">
          <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-400">
            <Users className="size-8" aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-semibold">Nenhum grupo ainda</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crie um grupo ou entre com um link de convite.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                to="/groups/$groupId"
                params={{ groupId: g.id }}
                className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3 shadow-soft transition-shadow hover:shadow-lift"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.member_count} {g.member_count === 1 ? "membro" : "membros"}
                  </p>
                </div>
                <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
