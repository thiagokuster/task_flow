import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  invite_expires_at: string;
  created_by: string;
  created_at: string;
  member_count: number;
};

export type GroupPreview = {
  id: string;
  name: string;
  expired: boolean;
};

export type GroupMember = {
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  full_name: string;
};

export const groupsQuery = queryOptions({
  queryKey: ["groups"],
  queryFn: async (): Promise<Group[]> => {
    const { data, error } = await supabase
      .from("groups")
      .select("id,name,invite_code,invite_expires_at,created_by,created_at,group_members(user_id)")
      .order("created_at", { ascending: false });
    fail(error);
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      invite_code: row.invite_code,
      invite_expires_at: row.invite_expires_at,
      created_by: row.created_by,
      created_at: row.created_at,
      member_count: row.group_members?.length ?? 0,
    }));
  },
});

export const groupQuery = (groupId: string) =>
  queryOptions({
    queryKey: ["groups", groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("id,name,invite_code,invite_expires_at,created_by,created_at")
        .eq("id", groupId)
        .maybeSingle();
      fail(error);
      return data;
    },
  });

export const groupMembersQuery = (groupId: string) =>
  queryOptions({
    queryKey: ["group-members", groupId],
    queryFn: async (): Promise<GroupMember[]> => {
      const { data, error } = await supabase
        .from("group_members")
        .select("user_id,role,joined_at,profiles(full_name)")
        .eq("group_id", groupId)
        .order("joined_at");
      fail(error);
      return (data ?? []).map((row) => {
        const profile = row.profiles as { full_name: string } | { full_name: string }[] | null;
        const full_name = Array.isArray(profile)
          ? (profile[0]?.full_name ?? "")
          : (profile?.full_name ?? "");
        return {
          user_id: row.user_id,
          role: row.role === "owner" ? "owner" : "member",
          joined_at: row.joined_at,
          full_name,
        };
      });
    },
  });

export async function createGroup(name: string): Promise<string> {
  const trimmed = name.trim();
  const { data, error } = await supabase.rpc("create_group", { _name: trimmed });
  if (!error && data) return data;
  fail(error);
  if (!data) throw new Error("Não foi possível criar o grupo.");
  return data;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

export function inviteErrorMessage(error: unknown, fallback = "Convite inválido."): string {
  const message = errorText(error).toLowerCase();
  if (message.includes("too many invite attempts")) {
    return "Muitas tentativas de convite. Aguarde alguns minutos.";
  }
  if (message.includes("invite expired") || message.includes("expirado")) {
    return "Este convite expirou. Peça um link novo ao dono do grupo.";
  }
  if (message.includes("invalid invite") || message.includes("not found")) {
    return "Convite inválido.";
  }
  if (message.includes("not group owner")) {
    return "Só o dono do grupo pode renovar o convite.";
  }
  return fallback;
}

export async function previewGroup(code: string): Promise<GroupPreview | null> {
  const { data, error } = await supabase.rpc("preview_group", { _code: code.trim() });
  if (error) throw new Error(inviteErrorMessage(error, error.message));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  if (row.invite_expired) return { id: "", name: "", expired: true };
  if (!row.id || !row.name) return null;
  return { id: row.id, name: row.name, expired: false };
}

export async function joinGroup(code: string): Promise<string> {
  const { data, error } = await supabase.rpc("join_group", { _code: code.trim() });
  if (error) throw new Error(inviteErrorMessage(error, error.message));
  if (!data) throw new Error("Convite inválido.");
  return data;
}

export async function rotateInviteCode(groupId: string): Promise<{ invite_code: string; invite_expires_at: string }> {
  const { data, error } = await supabase.rpc("rotate_invite_code", { _group_id: groupId });
  if (error) throw new Error(inviteErrorMessage(error, error.message));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.invite_code || !row.invite_expires_at) {
    throw new Error("Não foi possível renovar o convite.");
  }
  return { invite_code: row.invite_code, invite_expires_at: row.invite_expires_at };
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  fail(error);
}
