import { prisma } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import {
  GROUP_ADD_BATCH_MAX,
  GROUP_DEFAULT_MEMBER_LIMIT,
  type AddGroupMembersInput,
  type UpdateGroupConversationInput,
  type UpdateGroupMemberRoleInput,
} from "@/lib/messages/schemas";
import type { ConversationRole } from "@/lib/messages/queries";
import { appendSystemMessage } from "@/lib/messages/lifecycle";

/** 取触发者的展示名，给 SYSTEM 消息文案用；查不到 fallback 用 username。 */
async function actorDisplayName(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true },
  });
  return u?.name?.trim() || u?.username || "某位成员";
}

/** 取多个用户的展示名列表（按入参顺序）。 */
async function userDisplayNames(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, username: true },
  });
  const map = new Map(rows.map((u) => [u.id, u.name?.trim() || u.username]));
  return ids.map((id) => map.get(id) ?? "某位成员");
}

/** 失败不阻塞主流程的系统消息追加。 */
async function safeAppendSystemMessage(
  conversationId: string,
  triggeredById: string,
  content: string,
  options?: { extraNotifyUserIds?: ReadonlyArray<string> },
): Promise<void> {
  try {
    await appendSystemMessage(conversationId, triggeredById, content, options);
  } catch (err) {
    console.warn("[groups] appendSystemMessage", err);
  }
}

/**
 * Stage 12.2：群聊 CRUD + 成员管理业务层。
 *
 * 设计约束：
 * - OWNER 在群聊中唯一（创建时分配，不可通过此处接口降级），OWNER 想退群必须先解散群。
 * - ADMIN 由 OWNER 提拔；ADMIN 不能踢/降 ADMIN，只能管理 MEMBER。
 * - 1v1 老路径完全不受影响（findDirectConversation + Conversation.isGroup=false）。
 * - 通知放 Stage 12.4 系统消息再做（XX 加入了群聊 / XX 修改了群名）；本阶段只暴露 CRUD 接口。
 */

export type GroupRoleOp = "ADMIN" | "MEMBER";

export interface CreateGroupInput {
  title: string;
  avatarUrl?: string | null;
  memberIds: string[];
}

/** 群创建：把发起人 + 邀请列表全部塞进 conversation_participants，发起人为 OWNER。 */
export async function createGroupConversation(
  ownerId: string,
  input: CreateGroupInput,
): Promise<{ id: string }> {
  const inviteeIds = input.memberIds.filter((id) => id !== ownerId);
  if (inviteeIds.length === 0) {
    throw new ValidationError("邀请列表不能为空");
  }
  // 总人数 = owner + 去重去自身后的 invitees
  const totalParticipants = inviteeIds.length + 1;
  if (totalParticipants > GROUP_DEFAULT_MEMBER_LIMIT) {
    throw new ValidationError(
      `群成员不能超过 ${GROUP_DEFAULT_MEMBER_LIMIT} 人`,
    );
  }

  // 校验被邀请用户全部存在且不是已注销 / 封禁
  const users = await prisma.user.findMany({
    where: { id: { in: inviteeIds } },
    select: { id: true, status: true },
  });
  const validIds = new Set(
    users.filter((u) => u.status === "ACTIVE").map((u) => u.id),
  );
  const missing = inviteeIds.filter((id) => !validIds.has(id));
  if (missing.length > 0) {
    throw new ValidationError("部分被邀请用户不存在或已停用", {
      memberIds: missing,
    });
  }

  const created = await prisma.conversation.create({
    data: {
      isGroup: true,
      title: input.title,
      avatarUrl: input.avatarUrl ?? null,
      ownerId,
      memberLimit: GROUP_DEFAULT_MEMBER_LIMIT,
      participants: {
        create: [
          { userId: ownerId, role: "OWNER" },
          ...inviteeIds.map((id) => ({
            userId: id,
            role: "MEMBER" as ConversationRole,
          })),
        ],
      },
    },
    select: { id: true },
  });

  return created;
}

/** 鉴权 helper：拉出会话 + viewer 在该会话中的角色。非群聊 / 非成员一律拒绝。 */
async function assertGroupMembership(
  conversationId: string,
  viewerId: string,
): Promise<{
  conversation: {
    id: string;
    isGroup: boolean;
    ownerId: string | null;
    memberLimit: number;
  };
  viewerRole: ConversationRole;
}> {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, isGroup: true, ownerId: true, memberLimit: true },
  });
  if (!conv) throw new NotFoundError("会话");
  if (!conv.isGroup) throw new ValidationError("该会话不是群聊");

  const me = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: viewerId },
    },
    select: { role: true },
  });
  if (!me) throw new ForbiddenError("你不是该群成员");
  return { conversation: conv, viewerRole: me.role };
}

/** 群信息编辑（标题 / 头像）。OWNER + ADMIN 均可。改动会写入 SYSTEM 消息留痕。 */
export async function updateGroupConversation(
  viewerId: string,
  conversationId: string,
  input: UpdateGroupConversationInput,
): Promise<void> {
  const { viewerRole } = await assertGroupMembership(conversationId, viewerId);
  if (viewerRole !== "OWNER" && viewerRole !== "ADMIN") {
    throw new ForbiddenError("仅群主或管理员可修改群信息");
  }
  const previous = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { title: true, avatarUrl: true },
  });
  const data: { title?: string; avatarUrl?: string | null } = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl ?? null;
  await prisma.conversation.update({
    where: { id: conversationId },
    data,
  });

  const actorName = await actorDisplayName(viewerId);
  if (input.title !== undefined && input.title !== previous?.title) {
    await safeAppendSystemMessage(
      conversationId,
      viewerId,
      `${actorName} 修改群名为「${input.title}」`,
    );
  }
  const newAvatar = input.avatarUrl ?? null;
  if (input.avatarUrl !== undefined && newAvatar !== (previous?.avatarUrl ?? null)) {
    await safeAppendSystemMessage(
      conversationId,
      viewerId,
      newAvatar ? `${actorName} 更新了群头像` : `${actorName} 移除了群头像`,
    );
  }
}

/** OWNER 解散群聊。Cascade 会带走 participants/messages/notifications targetType=CONVERSATION。 */
export async function deleteGroupConversation(
  viewerId: string,
  conversationId: string,
): Promise<void> {
  const { viewerRole } = await assertGroupMembership(conversationId, viewerId);
  if (viewerRole !== "OWNER") {
    throw new ForbiddenError("仅群主可解散群聊");
  }
  await prisma.conversation.delete({ where: { id: conversationId } });
}

/** 添加成员（OWNER/ADMIN）。返回实际新增（已是成员的会被静默跳过）。 */
export async function addGroupMembers(
  viewerId: string,
  conversationId: string,
  input: AddGroupMembersInput,
): Promise<{ added: string[]; skipped: string[] }> {
  if (input.memberIds.length > GROUP_ADD_BATCH_MAX) {
    throw new ValidationError(`单次最多添加 ${GROUP_ADD_BATCH_MAX} 人`);
  }
  const { conversation, viewerRole } = await assertGroupMembership(
    conversationId,
    viewerId,
  );
  if (viewerRole !== "OWNER" && viewerRole !== "ADMIN") {
    throw new ForbiddenError("仅群主或管理员可添加成员");
  }

  // 现有成员 id 集合
  const current = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  const currentIds = new Set(current.map((p) => p.userId));

  const targetIds = input.memberIds.filter((id) => !currentIds.has(id));
  const skipped = input.memberIds.filter((id) => currentIds.has(id));

  if (targetIds.length === 0) {
    return { added: [], skipped };
  }

  const total = current.length + targetIds.length;
  if (total > conversation.memberLimit) {
    throw new ValidationError(
      `加入后将超过群成员上限 ${conversation.memberLimit} 人`,
    );
  }

  // 校验候选都存在且 ACTIVE
  const users = await prisma.user.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, status: true },
  });
  const validIds = new Set(
    users.filter((u) => u.status === "ACTIVE").map((u) => u.id),
  );
  const missing = targetIds.filter((id) => !validIds.has(id));
  if (missing.length > 0) {
    throw new ValidationError("部分被邀请用户不存在或已停用", {
      memberIds: missing,
    });
  }

  await prisma.conversationParticipant.createMany({
    data: targetIds.map((id) => ({
      conversationId,
      userId: id,
      role: "MEMBER" as ConversationRole,
    })),
    skipDuplicates: true, // 双重保险，防 race
  });

  const [actorName, addedNames] = await Promise.all([
    actorDisplayName(viewerId),
    userDisplayNames(targetIds),
  ]);
  const namesText =
    addedNames.length <= 3
      ? addedNames.join("、")
      : `${addedNames.slice(0, 3).join("、")} 等 ${addedNames.length} 人`;
  await safeAppendSystemMessage(
    conversationId,
    viewerId,
    `${actorName} 邀请 ${namesText} 加入了群聊`,
  );

  return { added: targetIds, skipped };
}

/** 移除成员。OWNER 可踢任意非 OWNER；ADMIN 仅可踢 MEMBER。不可移除 OWNER；不可 self-remove（请用 leave）。 */
export async function removeGroupMember(
  viewerId: string,
  conversationId: string,
  targetUserId: string,
): Promise<void> {
  if (viewerId === targetUserId) {
    throw new ValidationError("请使用退出群聊接口");
  }
  const { viewerRole } = await assertGroupMembership(conversationId, viewerId);
  const target = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: targetUserId },
    },
    select: { role: true },
  });
  if (!target) throw new NotFoundError("该用户不在群内");
  if (target.role === "OWNER") {
    throw new ForbiddenError("不能移除群主");
  }
  if (viewerRole === "MEMBER") {
    throw new ForbiddenError("仅群主或管理员可移除成员");
  }
  if (viewerRole === "ADMIN" && target.role === "ADMIN") {
    throw new ForbiddenError("管理员之间不能互相移除");
  }
  // OWNER → 任意非 OWNER；ADMIN → MEMBER
  await prisma.conversationParticipant.delete({
    where: {
      conversationId_userId: { conversationId, userId: targetUserId },
    },
  });

  const [actorName, [targetName]] = await Promise.all([
    actorDisplayName(viewerId),
    userDisplayNames([targetUserId]),
  ]);
  // Stage 12.5 post-audit LOW：把被踢用户也带入 SSE 推送，让他们的 Tab 触发 router.refresh
  // → 403 → 跳走，避免 UI 还停留在「成员视图」。
  await safeAppendSystemMessage(
    conversationId,
    viewerId,
    `${actorName} 将 ${targetName} 移出了群聊`,
    { extraNotifyUserIds: [targetUserId] },
  );
}

/** 改成员角色（OWNER → ADMIN 或 ADMIN → MEMBER）。仅 OWNER 可调用。 */
export async function updateGroupMemberRole(
  viewerId: string,
  conversationId: string,
  targetUserId: string,
  input: UpdateGroupMemberRoleInput,
): Promise<void> {
  if (viewerId === targetUserId) {
    throw new ValidationError("不能修改自己的角色");
  }
  const { viewerRole } = await assertGroupMembership(conversationId, viewerId);
  if (viewerRole !== "OWNER") {
    throw new ForbiddenError("仅群主可调整角色");
  }
  const target = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: targetUserId },
    },
    select: { role: true },
  });
  if (!target) throw new NotFoundError("该用户不在群内");
  if (target.role === "OWNER") {
    throw new ForbiddenError("不能修改群主角色");
  }
  if (target.role === input.role) {
    throw new ConflictError("该用户已是目标角色");
  }
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId, userId: targetUserId },
    },
    data: { role: input.role },
  });

  const [actorName, [targetName]] = await Promise.all([
    actorDisplayName(viewerId),
    userDisplayNames([targetUserId]),
  ]);
  const roleLabel = input.role === "ADMIN" ? "管理员" : "成员";
  await safeAppendSystemMessage(
    conversationId,
    viewerId,
    `${actorName} 将 ${targetName} 设为${roleLabel}`,
  );
}

/** 退出群聊（成员 / 管理员）。OWNER 必须先转让（未实现）或解散。 */
export async function leaveGroupConversation(
  viewerId: string,
  conversationId: string,
): Promise<void> {
  const { viewerRole } = await assertGroupMembership(conversationId, viewerId);
  if (viewerRole === "OWNER") {
    throw new ForbiddenError("群主不能退群，请先解散群聊");
  }
  await prisma.conversationParticipant.delete({
    where: {
      conversationId_userId: { conversationId, userId: viewerId },
    },
  });

  // 退群者已不在 participant 列表里，systemMessage 的 senderId 仍指他本人便于审计；
  // UI 渲染时也能找到对应头像（仍在 messageSender 关系里）。
  // Stage 12.5 post-audit LOW：把退群者带入 SSE 推送 —— 这样他另一个开着的 Tab 也会
  // 触发 router.refresh → 403 → 跳走，避免 UI 残留在群聊里。
  const actorName = await actorDisplayName(viewerId);
  await safeAppendSystemMessage(
    conversationId,
    viewerId,
    `${actorName} 退出了群聊`,
    { extraNotifyUserIds: [viewerId] },
  );
}

/** 列出群成员（仅成员可见）。详情页面板用。 */
export async function listGroupMembers(
  viewerId: string,
  conversationId: string,
) {
  await assertGroupMembership(conversationId, viewerId);
  return prisma.conversationParticipant.findMany({
    where: { conversationId },
    orderBy: [
      // OWNER < ADMIN < MEMBER 字符串排序碰巧不对，手动按角色优先级再排
      { createdAt: "asc" },
    ],
    select: {
      role: true,
      mutedUntil: true,
      createdAt: true,
      lastReadAt: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          industryRole: true,
        },
      },
    },
  });
}
