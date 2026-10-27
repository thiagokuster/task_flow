import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount, exportMyData } from "@/lib/account.functions";
import { displayFullName, displayInitial } from "@/lib/greeting";
import { profileQuery } from "@/lib/tasks";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Conta — TaskFlow" },
      { name: "description", content: "Exporte ou exclua os dados da sua conta TaskFlow." },
    ],
  }),
  component: Account,
});

function Account() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery(profileQuery);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);

  const fullName = displayFullName(data?.profile?.full_name, data?.user.email ?? null);
  const email = data?.user.email ?? "";
  const initial = displayInitial(data?.profile?.full_name, data?.user.email ?? null);

  async function downloadExport() {
    setExporting(true);
    try {
      const json = await exportMyData();
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taskflow-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Arquivo baixado.");
    } catch {
      toast.error("Não foi possível exportar os dados agora.");
    } finally {
      setExporting(false);
    }
  }

  async function destroy() {
    if (confirm !== "EXCLUIR") {
      toast.error("Digite EXCLUIR para confirmar.");
      return;
    }
    setDeleting(true);
    try {
      const result = await deleteMyAccount({ data: { confirm: "EXCLUIR" } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      qc.clear();
      await supabase.auth.signOut();
      toast.success("Conta excluída.");
      navigate({ to: "/", replace: true });
    } catch {
      toast.error("Não foi possível excluir a conta agora.");
    } finally {
      setDeleting(false);
      setOpen(false);
      setConfirm("");
    }
  }

  return (
    <div className="mt-2 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Conta</h1>
        <p className="mt-1 text-muted-foreground">
          Seus dados ficam isolados por conta. Você pode baixar uma cópia ou apagar tudo.
        </p>
      </div>

      <section className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-soft">
        <Avatar className="size-14">
          <AvatarFallback className="bg-primary/10 font-display text-lg font-bold text-primary">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">{fullName}</p>
          {email ? <p className="truncate text-sm text-muted-foreground">{email}</p> : null}
        </div>
      </section>

      <section className="space-y-3 rounded-xl bg-card p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-400">
            <Download className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Exportar dados</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gera um arquivo JSON com o perfil, tarefas e registros associados a esta conta.
              </p>
            </div>
            <Button type="button" onClick={downloadExport} disabled={exporting}>
              {exporting ? "Preparando…" : "Baixar meus dados"}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-destructive/25 bg-destructive/5 p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <Trash2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Excluir conta</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Apaga a conta e os dados ligados a ela. Se a sessão for antiga, pediremos que entre
                de novo antes de concluir.
              </p>
            </div>
            <AlertDialog
              open={open}
              onOpenChange={(next) => {
                setOpen(next);
                if (!next) setConfirm("");
              }}
            >
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive">
                  Excluir minha conta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir a conta de forma permanente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Digite EXCLUIR para confirmar.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div>
                  <Label htmlFor="confirm-delete">Confirmação</Label>
                  <Input
                    id="confirm-delete"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="off"
                    placeholder="EXCLUIR"
                    className="mt-2"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={destroy}
                    disabled={deleting || confirm !== "EXCLUIR"}
                  >
                    {deleting ? "Excluindo…" : "Excluir conta"}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </section>
    </div>
  );
}
