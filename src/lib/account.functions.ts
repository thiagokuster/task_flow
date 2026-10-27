import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Exports every record owned by the caller (LGPD data portability). */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [
      profile,
      tasks,
      projects,
      categories,
      tags,
      taskTags,
      notifications,
      audit,
      groups,
      members,
      comments,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("tasks").select("*"),
      supabase.from("projects").select("*"),
      supabase.from("categories").select("*"),
      supabase.from("tags").select("*"),
      supabase.from("task_tags").select("*"),
      supabase.from("notifications").select("*"),
      supabase.from("audit_events").select("*"),
      supabase.from("groups").select("*"),
      supabase.from("group_members").select("*"),
      supabase.from("task_comments").select("*"),
    ]);
    const failed = [
      profile,
      tasks,
      projects,
      categories,
      tags,
      taskTags,
      notifications,
      audit,
      groups,
      members,
      comments,
    ].find((result) => result.error);
    if (failed?.error) {
      console.error("data export failed");
      throw new Error("Não foi possível exportar os dados agora.");
    }
    await supabase.rpc("log_security_event", { _event: "data_exported" });
    return JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        account: { id: userId, email: context.claims.email ?? null },
        profile: profile.data,
        tasks: tasks.data,
        projects: projects.data,
        categories: categories.data,
        tags: tags.data,
        task_tags: taskTags.data,
        notifications: notifications.data,
        audit_events: audit.data,
        groups: groups.data,
        group_members: members.data,
        task_comments: comments.data,
      },
      null,
      2,
    );
  });

/**
 * Permanently deletes the caller's account and all related data (cascade).
 * The caller must re-authenticate in the browser right before calling this,
 * and the server additionally requires a fresh session (issued < 10 min ago).
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ confirm: z.literal("EXCLUIR") }).parse(d))
  .handler(async ({ context }) => {
    const iat = Number((context.claims as { iat?: number }).iat ?? 0);
    if (!iat || Date.now() / 1000 - iat > 600) {
      return { ok: false as const, error: "Por segurança, confirme sua identidade novamente." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) {
      console.error("account deletion failed");
      return { ok: false as const, error: "Não foi possível excluir a conta agora." };
    }
    return { ok: true as const };
  });
