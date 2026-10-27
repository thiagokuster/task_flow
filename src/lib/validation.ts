import { z } from "zod";
import { isDueAtPast, PAST_DUE_ERROR } from "@/lib/dates";

// Shared schemas: used in forms (client) and mirrored by database constraints (server).
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Informe seu e-mail.")
  .max(254, "E-mail muito longo.")
  .email("E-mail inválido.");

export const PASSWORD_HINT = "Mínimo de 10 caracteres, com letra maiúscula, minúscula e número.";

export const passwordSchema = z
  .string()
  .min(10, "A senha deve ter pelo menos 10 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.")
  .regex(/[a-z]/, "Inclua ao menos uma letra minúscula.")
  .regex(/[A-Z]/, "Inclua ao menos uma letra maiúscula.")
  .regex(/[0-9]/, "Inclua ao menos um número.");

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Informe seu nome completo.")
  .max(120, "Nome muito longo.");

export const signUpSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    terms: z.literal(true, { error: "Aceite os termos para continuar." }),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não coincidem.",
    path: ["confirm"],
  });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha.").max(128),
});

export const TASK_STATUSES = ["pending", "in_progress", "done", "archived"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  done: "Concluída",
  archived: "Arquivada",
};
export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};
export const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

function dueAtNotPast(value: string | null | undefined, ctx: z.RefinementCtx) {
  if (!value) return;
  if (isDueAtPast(value)) {
    ctx.addIssue({ code: "custom", message: PAST_DUE_ERROR });
  }
}

const taskFields = z.object({
  title: z.string().trim().min(1, "Informe um título.").max(200, "Máximo de 200 caracteres."),
  description: z.string().max(5000, "Máximo de 5000 caracteres."),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  due_at: z.string().nullable(),
  project_id: z.string().uuid().nullable(),
  category_id: z.string().uuid().nullable(),
  group_id: z.string().uuid().nullable(),
  assignee_id: z.string().uuid().nullable(),
  tag_ids: z.array(z.string().uuid()).max(20),
});

export const taskSchema = taskFields.superRefine((data, ctx) => dueAtNotPast(data.due_at, ctx));
export type TaskInput = z.infer<typeof taskSchema>;

export const taskPatchSchema = taskFields.partial().superRefine((data, ctx) => {
  if (data.due_at === undefined) return;
  dueAtNotPast(data.due_at, ctx);
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Escreva um comentário.").max(2000, "Máximo de 2000 caracteres."),
});
export type CommentInput = z.infer<typeof commentSchema>;

export const nameSchema = (max: number) =>
  z.string().trim().min(1, "Informe um nome.").max(max, `Máximo de ${max} caracteres.`);

/** Generic message that never reveals whether an e-mail exists. */
export const GENERIC_AUTH_ERROR = "E-mail ou senha inválidos, ou e-mail ainda não confirmado.";

export const AUTH_UNREACHABLE_ERROR =
  "Não foi possível conectar ao servidor de autenticação. Confira a internet e se o projeto Supabase está ativo.";

export function friendlyAuthError(message?: string): string {
  const m = (message ?? "").toLowerCase();
  if (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network request failed") ||
    m.includes("load failed") ||
    m.includes("err_name_not_resolved") ||
    m.includes("err_internet")
  )
    return AUTH_UNREACHABLE_ERROR;
  if (m.includes("provider is not enabled") || m.includes("unsupported provider"))
    return "O login com Google não está habilitado neste projeto Supabase.";
  if (m.includes("rate") || m.includes("too many") || m.includes("security purposes"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (m.includes("pwned") || m.includes("weak") || m.includes("compromised"))
    return "Essa senha apareceu em vazamentos conhecidos. Escolha outra senha.";
  if (m.includes("current password") || m.includes("reauthentication"))
    return "Senha atual incorreta ou ausente.";
  if (m.includes("same") && m.includes("password"))
    return "A nova senha deve ser diferente da atual.";
  if (m.includes("invalid totp") || m.includes("code")) return "Código inválido ou expirado.";
  return "Não foi possível concluir a operação. Tente novamente.";
}
