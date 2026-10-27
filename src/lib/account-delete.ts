export type GroupMembership = {
  group_id: string;
  user_id: string;
  joined_at: string;
  role: string;
};

export type GroupHandoffPlan = {
  deleteGroupIds: string[];
  transfers: { groupId: string; successorId: string }[];
};

/**
 * Decide how groups this user is responsible for (current owner or groups.created_by)
 * are treated when the account is deleted.
 */
export function planOwnedGroupHandoff(
  userId: string,
  members: GroupMembership[],
  responsibleGroupIds: string[] = [],
): GroupHandoffPlan {
  const byGroup = new Map<string, GroupMembership[]>();
  for (const member of members) {
    const list = byGroup.get(member.group_id) ?? [];
    list.push(member);
    byGroup.set(member.group_id, list);
  }

  const groupIds = new Set<string>(responsibleGroupIds);
  if (groupIds.size === 0) {
    for (const member of members) {
      if (member.user_id === userId && member.role === "owner") groupIds.add(member.group_id);
    }
  }

  const deleteGroupIds: string[] = [];
  const transfers: { groupId: string; successorId: string }[] = [];

  for (const groupId of groupIds) {
    const list = byGroup.get(groupId) ?? [];
    const successor = list
      .filter((member) => member.user_id !== userId)
      .slice()
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.user_id.localeCompare(b.user_id))[0];
    if (!successor) deleteGroupIds.push(groupId);
    else transfers.push({ groupId, successorId: successor.user_id });
  }

  return { deleteGroupIds, transfers };
}
