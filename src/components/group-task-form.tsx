import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { dueAtFromDateInput, isDateInputPast, PAST_DUE_ERROR, todayDateInput } from "@/lib/dates";
import type { GroupMember } from "@/lib/groups";
import { displayFullName } from "@/lib/greeting";
import { createTask } from "@/lib/tasks";

export function GroupTaskForm({
  groupId,
  members,
  currentUserId,
  onCreated,
}: {
  groupId: string;
  members: GroupMember[];
  currentUserId: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (currentUserId) setAssigneeId((current) => current || currentUserId);
  }, [currentUserId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || t.length > 200) return;
    if (!assigneeId) {
      toast.error("Escolha quem deve fazer a tarefa.");
      return;
    }
    if (due && isDateInputPast(due)) {
      toast.error(PAST_DUE_ERROR);
      return;
    }
    setBusy(true);
    try {
      await createTask({
        title: t,
        description: description.trim(),
        priority: "medium",
        status: "pending",
        due_at: dueAtFromDateInput(due),
        project_id: null,
        category_id: null,
        group_id: groupId,
        assignee_id: assigneeId,
        tag_ids: [],
      });
      setTitle("");
      setDescription("");
      setDue("");
      setAssigneeId(currentUserId);
      onCreated();
    } catch {
      toast.error("Não foi possível criar a tarefa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-card p-4 shadow-soft">
      <div>
        <Label htmlFor="group-task-title">Nome</Label>
        <Input
          id="group-task-title"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="O que precisa ser feito?"
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="group-task-desc">Descrição</Label>
        <Textarea
          id="group-task-desc"
          value={description}
          maxLength={5000}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalhes opcionais"
          className="mt-1.5 min-h-20"
        />
      </div>
      <div>
        <Label htmlFor="group-task-due">Prazo</Label>
        <Input
          id="group-task-due"
          type="date"
          min={todayDateInput()}
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <Label htmlFor="group-task-assignee">Quem deve fazer</Label>
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger id="group-task-assignee" className="mt-1.5">
            <SelectValue placeholder="Selecione um membro" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {displayFullName(m.full_name, null)}
                {m.user_id === currentUserId ? " (você)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={busy || !title.trim()}>
        {busy ? "Salvando…" : "Adicionar tarefa"}
      </Button>
    </form>
  );
}
