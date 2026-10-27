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

/** Decide how owned groups are treated when the owner deletes their account. */
export function planOwnedGroupHandoff(
  userId: string,
  members: GroupMembership[],
): GroupHandoffPlan {
  const byGroup = new Map<string, GroupMembership[]>();
  for (const member of members) {
    const list = byGroup.get(member.group_id) ?? [];
    list.push(member);
    byGroup.set(member.group_id, list);
  }

  const deleteGroupIds: string[] = [];
  const transfers: { groupId: string; successorId: string }[] = [];

  for (const [groupId, list] of byGroup) {
    const owns = list.some((member) => member.user_id === userId && member.role === "owner");
    if (!owns) continue;
    const successor = list
      .filter((member) => member.user_id !== userId)
      .slice()
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at))[0];
    if (!successor) deleteGroupIds.push(groupId);
    else transfers.push({ groupId, successorId: successor.user_id });
  }

  return { deleteGroupIds, transfers };
}
