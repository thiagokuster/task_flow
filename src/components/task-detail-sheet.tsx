import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { createComment, deleteComment, taskCommentsQuery } from "@/lib/comments";
import {
  dateInputFromDueAt,
  dueAtFromDateInput,
  formatCommentTime,
  isDateInputPast,
  PAST_DUE_ERROR,
  todayDateInput,
} from "@/lib/dates";
import { displayFullName } from "@/lib/greeting";
import { profileQuery, updateTask, type Task } from "@/lib/tasks";
import { commentSchema, STATUS_LABEL } from "@/lib/validation";

export function TaskDetailSheet({
  task,
  onClose,
  canEdit = true,
}: {
  task: Task | null;
  onClose: () => void;
  canEdit?: boolean;
}) {
  const qc = useQueryClient();
  const taskId = task?.id ?? "";
  const { data: comments = [] } = useQuery({
    ...taskCommentsQuery(taskId),
    enabled: Boolean(taskId),
  });
  const { data: profileData } = useQuery(profileQuery);
  const userId = profileData?.user.id ?? "";
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveDue(value: string) {
    if (!task) return;
    if (value && isDateInputPast(value)) {
      toast.error(PAST_DUE_ERROR);
      return;
    }
    try {
      await updateTask(task.id, { due_at: dueAtFromDateInput(value) });
      await qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch {
      toast.error("Não foi possível atualizar o prazo.");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!task) return;
    const parsed = commentSchema.safeParse({ body });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Comentário inválido.");
      return;
    }
    setBusy(true);
    try {
      await createComment(task.id, parsed.data.body);
      setBody("");
      await qc.invalidateQueries({ queryKey: ["task-comments", task.id] });
      await qc.invalidateQueries({ queryKey: ["comment-counts"] });
    } catch {
      toast.error("Não foi possível comentar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteComment(id);
      await qc.invalidateQueries({ queryKey: ["task-comments"] });
      await qc.invalidateQueries({ queryKey: ["comment-counts"] });
    } catch {
      toast.error("Não foi possível excluir o comentário.");
    }
  }

  return (
    <Sheet open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        {task ? (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 text-left font-display">{task.title}</SheetTitle>
              <SheetDescription className="text-left">
                {STATUS_LABEL[task.status]}
                {task.assignee_name ? ` · Para ${task.assignee_name}` : ""}
              </SheetDescription>
            </SheetHeader>

            {task.description ? (
              <p className="mt-4 text-sm text-muted-foreground">{task.description}</p>
            ) : null}

            <div className="mt-5">
              <Label htmlFor="task-due">Prazo</Label>
              <Input
                id="task-due"
                type="date"
                className="mt-1.5"
                min={todayDateInput()}
                value={dateInputFromDueAt(task.due_at)}
                disabled={!canEdit}
                onChange={(e) => void saveDue(e.target.value)}
              />
            </div>

            <section className="mt-8 flex min-h-0 flex-1 flex-col">
              <h3 className="font-semibold">Comentários</h3>
              {comments.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nenhum comentário ainda.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {comments.map((c) => (
                    <li key={c.id} className="flex gap-2.5">
                      <UserAvatar name={c.author_name} className="mt-0.5 size-8" />
                      <div className="min-w-0 flex-1 rounded-xl bg-muted/60 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">
                            {displayFullName(c.author_name, null)}
                          </p>
                          <p className="shrink-0 text-[11px] text-muted-foreground">
                            {formatCommentTime(c.created_at)}
                          </p>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                        {c.author_id === userId ? (
                          <button
                            type="button"
                            className="mt-1 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => void remove(c.id)}
                          >
                            Excluir
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={submit} className="mt-4 space-y-2">
                <Label htmlFor="task-comment">Novo comentário</Label>
                <Textarea
                  id="task-comment"
                  value={body}
                  maxLength={2000}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Escreva para o grupo"
                  className="min-h-20"
                />
                <Button type="submit" disabled={busy || !body.trim()}>
                  {busy ? "Enviando…" : "Comentar"}
                </Button>
              </form>
            </section>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
