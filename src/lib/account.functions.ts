import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planOwnedGroupHandoff } from "@/lib/account-delete";
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
 * Permanently deletes the caller's account and related data.
 * Groups with other members are handed to the earliest remaining member.
 * Empty owned groups are deleted. Requires a fresh session (< 10 min).
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
    const owned = await supabaseAdmin
      .from("group_members")
      .select("group_id")
      .eq("user_id", context.userId)
      .eq("role", "owner");
    if (owned.error) {
      console.error("account deletion failed");
      return { ok: false as const, error: "Não foi possível excluir a conta agora." };
    }
    const ownedIds = (owned.data ?? []).map((row) => row.group_id);
    let memberships: {
      group_id: string;
      user_id: string;
      joined_at: string;
      role: string;
    }[] = [];
    if (ownedIds.length) {
      const listed = await supabaseAdmin
        .from("group_members")
        .select("group_id,user_id,joined_at,role")
        .in("group_id", ownedIds);
      if (listed.error) {
        console.error("account deletion failed");
        return { ok: false as const, error: "Não foi possível excluir a conta agora." };
      }
      memberships = listed.data ?? [];
    }
    const plan = planOwnedGroupHandoff(context.userId, memberships);
    for (const groupId of plan.deleteGroupIds) {
      const { error } = await supabaseAdmin.from("groups").delete().eq("id", groupId);
      if (error) {
        console.error("account deletion failed");
        return { ok: false as const, error: "Não foi possível excluir a conta agora." };
      }
    }
    for (const transfer of plan.transfers) {
      const promote = await supabaseAdmin
        .from("group_members")
        .update({ role: "owner" })
        .eq("group_id", transfer.groupId)
        .eq("user_id", transfer.successorId);
      if (promote.error) {
        console.error("account deletion failed");
        return { ok: false as const, error: "Não foi possível excluir a conta agora." };
      }
      const owner = await supabaseAdmin
        .from("groups")
        .update({ created_by: transfer.successorId })
        .eq("id", transfer.groupId);
      if (owner.error) {
        console.error("account deletion failed");
        return { ok: false as const, error: "Não foi possível excluir a conta agora." };
      }
      const leave = await supabaseAdmin
        .from("group_members")
        .delete()
        .eq("group_id", transfer.groupId)
        .eq("user_id", context.userId);
      if (leave.error) {
        console.error("account deletion failed");
        return { ok: false as const, error: "Não foi possível excluir a conta agora." };
      }
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) {
      console.error("account deletion failed");
      return { ok: false as const, error: "Não foi possível excluir a conta agora." };
    }
    return { ok: true as const };
  });
