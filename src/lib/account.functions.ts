import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { needsReauth, REAUTH_REQUIRED_ERROR } from "@/lib/session";
import { z } from "zod";

/** Exports records that belong to the caller (LGPD data portability). */
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
      supabase.from("group_members").select("*").eq("user_id", userId),
      supabase.from("task_comments").select("*").eq("author_id", userId),
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
    const ownTasks = (tasks.data ?? []).filter(
      (task) => task.user_id === userId || task.created_by === userId || task.assignee_id === userId,
    );
    await supabase.rpc("log_security_event", { _event: "data_exported" });
    return JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        account: { id: userId, email: context.claims.email ?? null },
        profile: profile.data,
        tasks: ownTasks,
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
 * Permanently deletes the caller's account.
 * Group handoff + reassignment of shared tasks run in one RPC (auth.uid()).
 * Requires a recent password/OAuth authentication (AMR), not a refreshed JWT.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ confirm: z.literal("EXCLUIR") }).parse(d))
  .handler(async ({ context }) => {
    if (needsReauth(context.claims as { amr?: { timestamp?: number }[] })) {
      return { ok: false as const, error: REAUTH_REQUIRED_ERROR, needsReauth: true as const };
    }
    const prepared = await context.supabase.rpc("prepare_account_deletion");
    if (prepared.error) {
      const message = (prepared.error.message ?? "").toLowerCase();
      if (message.includes("reauthentication required")) {
        return { ok: false as const, error: REAUTH_REQUIRED_ERROR, needsReauth: true as const };
      }
      console.error("account deletion failed");
      return { ok: false as const, error: "Não foi possível excluir a conta agora." };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) {
      console.error("account deletion failed");
      return { ok: false as const, error: "Não foi possível excluir a conta agora." };
    }
    return { ok: true as const };
  });
