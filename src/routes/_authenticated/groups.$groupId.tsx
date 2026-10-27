import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, RefreshCw } from "lucide-react";
import { FilterPills } from "@/components/filter-pills";
import { GroupTaskForm } from "@/components/group-task-form";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import { TaskRow } from "@/components/task-row";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { groupMembersQuery, groupQuery, leaveGroup, rotateInviteCode } from "@/lib/groups";
import { matchesScope, TASK_SCOPES, type TaskScope } from "@/lib/task-filters";
import {
  commentCountsQuery,
  deleteTask,
  profileQuery,
  tasksQuery,
  updateTask,
  withCommentCounts,
} from "@/lib/tasks";
import type { TaskStatus } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Grupo — TaskFlow" },
      { name: "description", content: "Membros e tarefas do grupo." },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const { groupId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: group, isLoading: loadingGroup } = useQuery(groupQuery(groupId));
  const { data: members = [] } = useQuery(groupMembersQuery(groupId));
  const { data: rawTasks = [] } = useQuery(tasksQuery);
  const { data: commentCounts } = useQuery(commentCountsQuery);
  const allTasks = useMemo(
    () => withCommentCounts(rawTasks, commentCounts),
    [rawTasks, commentCounts],
  );
  const { data: profileData } = useQuery(profileQuery);
  const [scope, setScope] = useState<TaskScope>("group_all");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const userId = profileData?.user.id ?? "";
  const isOwner = members.some((member) => member.user_id === userId && member.role === "owner");
  const inviteUrl =
    typeof window !== "undefined" && group
      ? `${window.location.origin}/join/${group.invite_code}`
      : "";

  const tasks = useMemo(
    () =>
      allTasks.filter((t) => t.group_id === groupId && (!userId || matchesScope(t, scope, userId))),
    [allTasks, groupId, scope, userId],
  );
  const openTask = openTaskId ? (allTasks.find((t) => t.id === openTaskId) ?? null) : null;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    void qc.invalidateQueries({ queryKey: ["groups"] });
    void qc.invalidateQueries({ queryKey: ["group-members", groupId] });
  };

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Link de convite copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  async function rotateInvite() {
    try {
      await rotateInviteCode(groupId);
      await qc.invalidateQueries({ queryKey: ["groups"] });
      await qc.invalidateQueries({ queryKey: ["groups", groupId] });
      toast.success("Novo link de convite gerado. O anterior deixa de valer.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível renovar o convite.");
    }
  }

  async function setStatus(id: string, status: TaskStatus) {
    try {
      await updateTask(id, { status });
      refresh();
    } catch {
      toast.error("Não foi possível atualizar a tarefa.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta tarefa?")) return;
    try {
      await deleteTask(id);
      refresh();
    } catch {
      toast.error("Não foi possível excluir a tarefa.");
    }
  }

  async function leave() {
    if (!userId) return;
    const leaveMessage = isOwner
      ? "Sair deste grupo? Se houver outros membros, quem entrou primeiro vira dono. Se você estiver sozinho, o grupo é excluído."
      : "Sair deste grupo?";
    if (!confirm(leaveMessage)) return;
    try {
      await leaveGroup(groupId, userId);
      await qc.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Você saiu do grupo.");
      navigate({ to: "/groups" });
    } catch {
      toast.error("Não foi possível sair do grupo.");
    }
  }

  if (loadingGroup) {
    return <p className="mt-8 text-muted-foreground">Carregando…</p>;
  }
  if (!group) {
    return (
      <div className="mt-8 space-y-3">
        <p className="text-muted-foreground">Grupo não encontrado ou você não faz parte dele.</p>
        <Button variant="outline" asChild>
          <Link to="/groups">Voltar aos grupos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link to="/groups" className="underline-offset-4 hover:underline">
              Grupos
            </Link>
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">{group.name}</h1>
        </div>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={leave}>
          Sair do grupo
        </Button>
      </div>

      <section className="space-y-3 rounded-xl bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400">
            <Link2 className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold">Link de convite</h2>
            <p className="text-sm text-muted-foreground">
              Expira em{" "}
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(group.invite_expires_at),
              )}
              . Só o dono pode renovar.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/60 px-3 py-2 text-sm">
            {inviteUrl || `/join/${group.invite_code}`}
          </code>
          <Button type="button" variant="secondary" onClick={copyInvite}>
            <Copy />
            Copiar
          </Button>
          {isOwner ? (
            <Button type="button" variant="outline" onClick={rotateInvite}>
              <RefreshCw />
              Renovar
            </Button>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Membros</h2>
        <ul className="space-y-2">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 shadow-soft"
            >
              <UserAvatar name={m.full_name} className="size-9" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.full_name || "Membro"}</p>
                <p className="text-xs text-muted-foreground">
                  {m.role === "owner" ? "Dono" : "Membro"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold">Nova tarefa</h2>
        <GroupTaskForm
          groupId={groupId}
          members={members}
          currentUserId={userId}
          onCreated={refresh}
        />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Tarefas</h2>
          <FilterPills
            items={TASK_SCOPES}
            value={scope}
            onChange={setScope}
            label="Filtrar por responsabilidade"
          />
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa neste filtro.</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                canEdit={t.created_by === userId || t.assignee_id === userId || isOwner}
                canDelete={t.created_by === userId || isOwner}
                onToggle={() => setStatus(t.id, t.status === "done" ? "pending" : "done")}
                onStatus={(status) => setStatus(t.id, status)}
                onRemove={() => remove(t.id)}
                onOpen={() => setOpenTaskId(t.id)}
              />
            ))}
          </ul>
        )}
      </section>
      <TaskDetailSheet
        task={openTask}
        canEdit={
          !!openTask && (openTask.created_by === userId || openTask.assignee_id === userId || isOwner)
        }
        onClose={() => setOpenTaskId(null)}
      />
    </div>
  );
}
