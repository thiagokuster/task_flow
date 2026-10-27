import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, Clock, ListTodo, Play, Plus, Sparkles } from "lucide-react";
import { FilterPills } from "@/components/filter-pills";
import { TaskDetailSheet } from "@/components/task-detail-sheet";
import { TaskRow } from "@/components/task-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { dueAtFromDateInput, isDateInputPast, PAST_DUE_ERROR, todayDateInput } from "@/lib/dates";
import { dashboardSubtitle, displayFirstName } from "@/lib/greeting";
import { matchesScope, TASK_SCOPES, type TaskScope } from "@/lib/task-filters";
import {
  createTask,
  deleteTask,
  profileQuery,
  tasksQuery,
  updateTask,
  type Task,
} from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/lib/validation";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel — TaskFlow" },
      { name: "description", content: "Seu painel de tarefas." },
    ],
  }),
  component: Dashboard,
});

type ListFilter = "all" | "open" | "done";

const LIST_FILTERS: { id: ListFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "open", label: "Pendentes" },
  { id: "done", label: "Concluídas" },
];

function matchesFilter(task: Task, filter: ListFilter): boolean {
  if (filter === "open") return task.status === "pending" || task.status === "in_progress";
  if (filter === "done") return task.status === "done";
  return true;
}

function Dashboard() {
  const qc = useQueryClient();
  const { data: tasks = [], isLoading, isError } = useQuery(tasksQuery);
  const { data: profileData } = useQuery(profileQuery);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [filter, setFilter] = useState<ListFilter>("all");
  const [scope, setScope] = useState<TaskScope>("mine");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  const pending = tasks.filter((t) => t.status === "pending").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const tracked = pending + inProgress + done;
  const completion = tracked === 0 ? 0 : Math.round((done / tracked) * 100);
  const name = displayFirstName(profileData?.profile?.full_name, profileData?.user.email ?? null);
  const userId = profileData?.user.id ?? "";
  const visibleTasks = tasks.filter(
    (t) => matchesFilter(t, filter) && (!userId || matchesScope(t, scope, userId)),
  );
  const openTask = openTaskId ? (tasks.find((t) => t.id === openTaskId) ?? null) : null;

  const stats = [
    {
      label: "Total",
      value: tasks.length,
      icon: ListTodo,
      wrap: "bg-muted/70 text-muted-foreground",
    },
    {
      label: "Pendentes",
      value: pending,
      icon: Clock,
      wrap: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    },
    {
      label: "Em andamento",
      value: inProgress,
      icon: Play,
      wrap: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    },
    {
      label: "Concluídas",
      value: done,
      icon: Check,
      wrap: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    },
  ] as const;

  async function add(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || t.length > 200) return;
    if (due && isDateInputPast(due)) {
      toast.error(PAST_DUE_ERROR);
      return;
    }
    try {
      await createTask({
        title: t,
        description: "",
        priority: "medium",
        status: "pending",
        due_at: dueAtFromDateInput(due),
        project_id: null,
        category_id: null,
        group_id: null,
        assignee_id: null,
        tag_ids: [],
      });
      setTitle("");
      setDue("");
      setFilter("open");
      refresh();
    } catch {
      toast.error("Não foi possível criar a tarefa.");
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

  async function toggle(id: string, status: TaskStatus) {
    await setStatus(id, status === "done" ? "pending" : "done");
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

  return (
    <>
      <section className="mt-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Olá, {name} 👋</h1>
        <p className="mt-1 text-muted-foreground">
          {dashboardSubtitle({ pending, inProgress, done })}
        </p>
      </section>

      <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-card p-4 shadow-soft transition-shadow hover:shadow-lift"
          >
            <div
              className={cn(
                "mb-3 inline-flex size-9 items-center justify-center rounded-lg",
                s.wrap,
              )}
            >
              <s.icon className="size-4" aria-hidden />
            </div>
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="font-display text-4xl font-bold tracking-tight">{s.value}</p>
          </div>
        ))}
        <div className="col-span-2 flex flex-col justify-center rounded-xl bg-card p-4 shadow-soft transition-shadow hover:shadow-lift lg:col-span-1">
          <p className="text-sm text-muted-foreground">Conclusão</p>
          <p className="font-display text-4xl font-bold tracking-tight">{completion}%</p>
          <Progress value={completion} className="mt-3" aria-label="Progresso de conclusão" />
          <p className="mt-2 text-xs text-muted-foreground">
            {done} de {tracked || 0} concluídas
          </p>
        </div>
      </section>

      <form onSubmit={add} className="mt-8">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-input bg-card p-1.5 shadow-soft focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40">
          <Plus className="ml-2 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            ref={inputRef}
            aria-label="Nova tarefa"
            placeholder="Nova tarefa"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 md:text-base"
          />
          <Input
            type="date"
            aria-label="Prazo"
            min={todayDateInput()}
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-11 w-auto max-w-40 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <kbd className="hidden rounded-md border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground sm:inline">
            Enter
          </kbd>
          <Button type="submit" className="shrink-0">
            Adicionar
          </Button>
        </div>
      </form>

      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Carregando…</p>
      ) : isError ? (
        <p className="mt-8 text-sm text-destructive">
          Não foi possível carregar as tarefas. Recarregue a página e tente de novo.
        </p>
      ) : tasks.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed bg-card/50 px-6 py-16 text-center">
          <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-8" aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-semibold">Tudo limpo por aqui!</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Crie a primeira tarefa e acompanhe o que precisa ser feito hoje.
          </p>
          <Button type="button" className="mt-5" onClick={() => inputRef.current?.focus()}>
            Criar primeira tarefa
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap gap-2">
            <FilterPills
              items={TASK_SCOPES}
              value={scope}
              onChange={setScope}
              label="Filtrar por responsabilidade"
            />
            <FilterPills
              items={LIST_FILTERS}
              value={filter}
              onChange={setFilter}
              label="Filtrar por status"
            />
          </div>
          {visibleTasks.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Nenhuma tarefa neste filtro.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {visibleTasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={() => toggle(t.id, t.status)}
                  onStatus={(status) => setStatus(t.id, status)}
                  onRemove={() => remove(t.id)}
                  onOpen={() => setOpenTaskId(t.id)}
                />
              ))}
            </ul>
          )}
        </>
      )}
      <TaskDetailSheet task={openTask} onClose={() => setOpenTaskId(null)} />
    </>
  );
}
