import { prisma } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import {
  MESSAGE_EDIT_WINDOW_MS,
  MESSAGE_RECALL_WINDOW_MS,
  MUTE_MAX_HOURS,
  type EditMessageInput,
} from "@/lib/messages/schemas";

/**
 * Stage 12.4：消息生命周期 + 群聊免打扰
 *
 * - editMessage：发送者本人 / 仅 TEXT / 仅在 15min 编辑窗口内 / 软删除消息不能改。
 * - softDeleteMessage：发送者本人 2min 内可撤回；群主 / 管理员不受窗口限制，但
 *   不能撤回其他管理员或群主的消息（与 group ACL 对齐）。SYSTEM 消息不可撤回。
 * - parseMentions：从纯文本里抽出 @username 列表，去重且保留出现顺序。
 * - appendSystemMessage：写一条 type=SYSTEM 的消息 + 推 lastMessageAt。
 * - muteConversation：把 conversation_participants.muted_until 推到未来时间点。
 *
 * 所有方法都假定调用方已通过会话访问鉴权；权限校验在 helper 内部再次兜底。
 */

export type MessageOwnership = {
  id: string;
  conversationId: string;
  senderId: string;
  type: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
  createdAt: Date;
  deletedAt: Date | null;
};

/** 取消息基础信息（含 conversation.isGroup / viewer 角色），用于权限判定。 */
async function loadMessageContext(messageId: string, viewerId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      type: true,
      createdAt: true,
      deletedAt: true,
    },
  });
  if (!message) throw new NotFoundError("消息");

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: message.conversationId,
        userId: viewerId,
      },
    },
    select: { role: true },
  });
  if (!participant) throw new ForbiddenError("你不是该会话的参与者");

  const conversation = await prisma.conversation.findUnique({
    where: { id: message.conversationId },
    select: { id: true, isGroup: true, ownerId: true },
  });
  if (!conversation) throw new NotFoundError("会话");

  return {
    message: message as MessageOwnership,
    viewerRole: participant.role,
    conversation,
  };
}

/**
 * 编辑文本消息内容。
 * - 仅 senderId === viewerId
 * - 仅 TEXT（IMAGE/FILE/SYSTEM 不允许改文本——附件改文本会跟列表预览不一致）
 * - 仅在 MESSAGE_EDIT_WINDOW_MS 窗口内
 * - 软删除消息不能再编辑
 * 返回新消息。
 */
export async function editMessage(
  viewerId: string,
  messageId: string,
  input: EditMessageInput,
): Promise<{ id: string; content: string; editedAt: Date }> {
  const { message } = await loadMessageContext(messageId, viewerId);
  if (message.senderId !== viewerId) {
    throw new ForbiddenError("只能编辑自己的消息");
  }
  if (message.deletedAt) {
    throw new ConflictError("已撤回的消息不能再编辑");
  }
  if (message.type !== "TEXT") {
    throw new ValidationError("仅文本消息支持编辑");
  }
  const age = Date.now() - message.createdAt.getTime();
  if (age > MESSAGE_EDIT_WINDOW_MS) {
    throw new ForbiddenError(
      `仅允许在发送后 ${Math.round(MESSAGE_EDIT_WINDOW_MS / 60000)} 分钟内编辑`,
    );
  }
  const now = new Date();
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { content: input.content, editedAt: now },
    select: { id: true, content: true, editedAt: true },
  });
  return {
    id: updated.id,
    content: updated.content,
    editedAt: updated.editedAt!,
  };
}

/**
 * 软删除（撤回）消息。
 * - 发送者本人在 MESSAGE_RECALL_WINDOW_MS 内可撤回（任何类型，除 SYSTEM）。
 * - 群主 / 管理员可强删任意 MEMBER 消息（无窗口限制）；不能删 OWNER；ADMIN 不能删 ADMIN。
 * - 1v1 会话只允许 sender 自己撤回。
 * - SYSTEM 消息一律不可删（避免操作记录被抹）。
 *
 * 实际操作：写 deletedAt + 清空 content/attachments；保留 sender/type 便于 UI placeholder。
 */
export async function softDeleteMessage(
  viewerId: string,
  messageId: string,
): Promise<void> {
  const { message, viewerRole, conversation } = await loadMessageContext(
    messageId,
    viewerId,
  );
  if (message.deletedAt) {
    throw new ConflictError("该消息已被撤回");
  }
  if (message.type === "SYSTEM") {
    throw new ForbiddenError("系统消息不能撤回");
  }

  const isSender = message.senderId === viewerId;
  if (isSender) {
    const age = Date.now() - message.createdAt.getTime();
    if (age > MESSAGE_RECALL_WINDOW_MS) {
      throw new ForbiddenError(
        `仅允许在发送后 ${Math.round(MESSAGE_RECALL_WINDOW_MS / 60000)} 分钟内撤回`,
      );
    }
  } else {
    if (!conversation.isGroup) {
      throw new ForbiddenError("只能撤回自己的消息");
    }
    if (viewerRole !== "OWNER" && viewerRole !== "ADMIN") {
      throw new ForbiddenError("仅群主或管理员可强制撤回他人消息");
    }
    // 校验被撤者的角色
    const senderRow = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: message.conversationId,
          userId: message.senderId,
        },
      },
      select: { role: true },
    });
    // 已退群（senderRow=null）→ ADMIN/OWNER 可清理；视为 MEMBER 处理。
    const senderRole = senderRow?.role ?? "MEMBER";
    if (senderRole === "OWNER") {
      throw new ForbiddenError("不能撤回群主的消息");
    }
    if (viewerRole === "ADMIN" && senderRole === "ADMIN") {
      throw new ForbiddenError("管理员之间不能互相撤回消息");
    }
  }

  await prisma.message.update({
    where: { id: messageId },
    data: {
      deletedAt: new Date(),
      content: "",
      attachments: undefined,
    },
  });
}

/** @username 解析：抽取 `@xxx`，按出现顺序去重；不验证用户是否存在（调用方按需做）。 */
const MENTION_RE = /(?:^|[^A-Za-z0-9_@])@([A-Za-z0-9_-]{1,64})/g;
export function parseMentions(content: string): string[] {
  if (!content) return [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const match of content.matchAll(MENTION_RE)) {
    const name = match[1].toLowerCase();
    if (!seen.has(name)) {
      seen.add(name);
      ordered.push(match[1]);
    }
  }
  return ordered;
}

/**
 * 追加一条 SYSTEM 消息到会话，并把 lastMessageAt 推到现在。
 * 不会触发用户通知；只在会话内部留痕。
 * senderId 取「触发动作的用户」用于事后排查 / UI 显示「XX」是谁。
 */
export async function appendSystemMessage(
  conversationId: string,
  triggeredById: string,
  content: string,
): Promise<{ id: string }> {
  const now = new Date();
  const [created] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId: triggeredById,
        content,
        type: "SYSTEM",
      },
      select: { id: true },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    }),
  ]);
  return created;
}

/**
 * 把当前用户在该会话的免打扰时间推到 now + hours；hours=0 取消免打扰。
 * 静默忽略「非成员」错误（前端跳过会话后端不应吵）。
 */
export async function muteConversation(
  viewerId: string,
  conversationId: string,
  hours: number,
): Promise<{ mutedUntil: Date | null }> {
  if (hours < 0 || hours > MUTE_MAX_HOURS) {
    throw new ValidationError("免打扰时长非法");
  }
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: { conversationId, userId: viewerId },
    },
    select: { conversationId: true },
  });
  if (!participant) throw new ForbiddenError("你不是该会话的参与者");

  const mutedUntil = hours === 0 ? null : new Date(Date.now() + hours * 3600_000);
  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: { conversationId, userId: viewerId },
    },
    data: { mutedUntil },
  });
  return { mutedUntil };
}
