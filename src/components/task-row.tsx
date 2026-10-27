import { MessageCircle, MoreHorizontal } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDueDate } from "@/lib/dates";
import { isOverdue, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type TaskStatus } from "@/lib/validation";

const STATUS_BADGE: Record<TaskStatus, string> = {
  pending: "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300",
  in_progress: "border-transparent bg-sky-500/15 text-sky-800 dark:text-sky-300",
  done: "border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  archived: "border-transparent bg-muted text-muted-foreground",
};

export function TaskRow({
  task,
  onToggle,
  onStatus,
  onRemove,
  onOpen,
}: {
  task: Task;
  onToggle: () => void;
  onStatus: (status: TaskStatus) => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const due = formatDue(task);
  const meta = [due?.label, task.assignee_name ? `Para ${task.assignee_name}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-center gap-3 rounded-xl bg-card px-3 py-3 shadow-soft transition-shadow hover:shadow-lift">
      <Checkbox
        aria-label={`Concluir ${task.title}`}
        checked={task.status === "done"}
        onCheckedChange={() => onToggle()}
        className="size-5"
      />
      {task.assignee_name ? (
        <UserAvatar name={task.assignee_name} className="hidden size-9 sm:flex" />
      ) : null}
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            "truncate font-medium",
            task.status === "done" && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        {task.description ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.description}</p>
        ) : null}
        {meta ? (
          <p
            className={cn(
              "mt-0.5 text-xs",
              due?.overdue ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {meta}
          </p>
        ) : null}
      </button>
      {task.comment_count > 0 ? (
        <span className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
          <MessageCircle className="size-3.5" aria-hidden />
          {task.comment_count}
        </span>
      ) : null}
      <Badge className={cn("hidden shrink-0 sm:inline-flex", STATUS_BADGE[task.status])}>
        {STATUS_LABEL[task.status]}
      </Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`Ações de ${task.title}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpen}>Abrir detalhes</DropdownMenuItem>
          {task.status !== "pending" ? (
            <DropdownMenuItem onClick={() => onStatus("pending")}>
              Marcar como pendente
            </DropdownMenuItem>
          ) : null}
          {task.status !== "in_progress" ? (
            <DropdownMenuItem onClick={() => onStatus("in_progress")}>
              Marcar em andamento
            </DropdownMenuItem>
          ) : null}
          {task.status !== "done" ? (
            <DropdownMenuItem onClick={() => onStatus("done")}>
              Marcar como concluída
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onRemove}>
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function formatDue(task: Task): { label: string; overdue: boolean } | null {
  if (!task.due_at) return null;
  const label = formatDueDate(task.due_at);
  if (!label) return null;
  return { label: `Prazo ${label}`, overdue: isOverdue(task) };
}
