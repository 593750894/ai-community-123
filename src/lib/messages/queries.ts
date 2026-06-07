import { prisma } from "@/lib/db";

/** 群聊角色，对外暴露字符串字面量，避免上游强依赖 prisma client 枚举对象。 */
export type ConversationRole = "OWNER" | "ADMIN" | "MEMBER";
/** 消息类型字面量。 */
export type MessageType = "TEXT" | "IMAGE" | "FILE" | "SYSTEM";

/** Message.attachments JSON 形状（Stage 12.3 写入；Stage 12.1 只暴露类型）。 */
export type MessageAttachment = {
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
};

/** 会话内的简化用户视图，列表 / 详情 / 系统消息均复用。 */
export type ConversationUser = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  industryRole: string | null;
};

export type ConversationListItem = {
  id: string;
  lastMessageAt: Date;
  unreadCount: number;
  /** Stage 12.1：群聊扩展字段。 */
  isGroup: boolean;
  title: string | null;
  avatarUrl: string | null;
  ownerId: string | null;
  viewerRole: ConversationRole;
  participantCount: number;
  /** 1v1 时为对方信息；群聊为 null（UI 用 title + avatarUrl 渲染）。 */
  otherUser: ConversationUser | null;
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: Date;
    type: MessageType;
    /** 仅 SYSTEM/IMAGE/FILE 才非空；TEXT 为 null。 */
    attachments: MessageAttachment[] | null;
    /** 软删除标记；UI 展示「消息已删除」。 */
    deletedAt: Date | null;
  } | null;
};

/**
 * 解析 attachments JSON。Prisma 返回 unknown，这里做一次最浅检查后强转，
 * 不对内部字段格式做严校验（写入侧保证；读取侧若坏数据回 null 而非崩）。
 */
function parseAttachments(value: unknown): MessageAttachment[] | null {
  if (!Array.isArray(value)) return null;
  return value as MessageAttachment[];
}

/**
 * 列出当前用户参与的所有会话，按最后消息时间倒序。
 *
 * - 1v1（isGroup=false）：otherUser = 第一个非自己的参与者
 * - 群聊（isGroup=true）：otherUser=null，UI 用 title/avatarUrl 渲染
 *
 * 未读数 = 对方在「我上次阅读时间」之后发送的消息数（群聊时统计所有非自己发送者）。
 */
export async function listConversationsForUser(
  userId: string,
): Promise<ConversationListItem[]> {
  const rows = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    orderBy: { lastMessageAt: "desc" },
    include: {
      participants: {
        include: {
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
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          content: true,
          senderId: true,
          createdAt: true,
          type: true,
          attachments: true,
          deletedAt: true,
        },
      },
    },
  });

  const items = await Promise.all(
    rows.map(async (c) => {
      const me = c.participants.find((p) => p.userId === userId);
      const other = c.participants.find((p) => p.userId !== userId);
      const unreadCount = me
        ? await prisma.message.count({
            where: {
              conversationId: c.id,
              senderId: { not: userId },
              createdAt: { gt: me.lastReadAt },
              deletedAt: null,
            },
          })
        : 0;
      const last = c.messages[0] ?? null;
      return {
        id: c.id,
        lastMessageAt: c.lastMessageAt,
        unreadCount,
        isGroup: c.isGroup,
        title: c.title,
        avatarUrl: c.avatarUrl,
        ownerId: c.ownerId,
        viewerRole: me?.role ?? ("MEMBER" as ConversationRole),
        participantCount: c.participants.length,
        otherUser: c.isGroup ? null : (other?.user ?? null),
        lastMessage: last
          ? {
              content: last.content,
              senderId: last.senderId,
              createdAt: last.createdAt,
              type: last.type,
              attachments: parseAttachments(last.attachments),
              deletedAt: last.deletedAt,
            }
          : null,
      } satisfies ConversationListItem;
    }),
  );

  return items;
}

export type ConversationMessage = {
  id: string;
  content: string;
  senderId: string;
  createdAt: Date;
  type: MessageType;
  attachments: MessageAttachment[] | null;
  editedAt: Date | null;
  deletedAt: Date | null;
};

export type ConversationDetailParticipant = {
  user: ConversationUser;
  role: ConversationRole;
  mutedUntil: Date | null;
  lastReadAt: Date;
  joinedAt: Date;
};

export type ConversationDetail = {
  id: string;
  isGroup: boolean;
  title: string | null;
  avatarUrl: string | null;
  ownerId: string | null;
  memberLimit: number;
  viewerRole: ConversationRole;
  participants: ConversationDetailParticipant[];
  /** 1v1 兼容字段：对方用户（群聊为 null）。 */
  otherUser: ConversationUser | null;
  messages: ConversationMessage[];
};

/**
 * 取一个会话的详情（仅当 userId 是参与者）。否则返回 null。
 *
 * Stage 12.1：除了原 1v1 字段，还返回 isGroup/title/avatarUrl/ownerId/memberLimit
 * 以及参与者完整列表（含角色 + 静音状态），方便后续 12.2 群聊面板复用。
 */
export async function getConversationForUser(
  conversationId: string,
  userId: string,
): Promise<ConversationDetail | null> {
  const conv = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId } },
    },
    include: {
      participants: {
        include: {
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
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
          type: true,
          attachments: true,
          editedAt: true,
          deletedAt: true,
        },
      },
    },
  });
  if (!conv) return null;

  const me = conv.participants.find((p) => p.userId === userId);
  const other = conv.participants.find((p) => p.userId !== userId);

  return {
    id: conv.id,
    isGroup: conv.isGroup,
    title: conv.title,
    avatarUrl: conv.avatarUrl,
    ownerId: conv.ownerId,
    memberLimit: conv.memberLimit,
    viewerRole: me?.role ?? ("MEMBER" as ConversationRole),
    participants: conv.participants.map((p) => ({
      user: p.user,
      role: p.role,
      mutedUntil: p.mutedUntil,
      lastReadAt: p.lastReadAt,
      joinedAt: p.createdAt,
    })),
    otherUser: conv.isGroup ? null : (other?.user ?? null),
    messages: conv.messages.map((m) => ({
      id: m.id,
      content: m.content,
      senderId: m.senderId,
      createdAt: m.createdAt,
      type: m.type,
      attachments: parseAttachments(m.attachments),
      editedAt: m.editedAt,
      deletedAt: m.deletedAt,
    })),
  };
}

/**
 * 把当前用户在该会话中的 lastReadAt 推到现在。
 * 用于打开会话详情时清空未读数。
 */
export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  await prisma.conversationParticipant.updateMany({
    where: { conversationId, userId },
    data: { lastReadAt: new Date() },
  });
}

/**
 * 当前用户的全站未读消息数（用于侧边栏 badge，预留）。
 * 软删除的消息不计入未读。
 */
export async function getTotalUnreadForUser(userId: string): Promise<number> {
  const parts = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });
  if (parts.length === 0) return 0;
  return prisma.message.count({
    where: {
      OR: parts.map((p) => ({
        conversationId: p.conversationId,
        senderId: { not: userId },
        createdAt: { gt: p.lastReadAt },
        deletedAt: null,
      })),
    },
  });
}

/**
 * 1v1 会话查找：仅命中 isGroup=false、参与者恰好为 [me, other] 的会话。
 * 用于 startConversation / POST /api/conversations 共享去重逻辑（Stage 12.1 抽出）。
 */
export async function findDirectConversation(
  userIdA: string,
  userIdB: string,
): Promise<{ id: string } | null> {
  const candidates = await prisma.conversation.findMany({
    where: {
      isGroup: false,
      AND: [
        { participants: { some: { userId: userIdA } } },
        { participants: { some: { userId: userIdB } } },
      ],
    },
    select: {
      id: true,
      _count: { select: { participants: true } },
    },
  });
  const match = candidates.find((c) => c._count.participants === 2);
  return match ? { id: match.id } : null;
}
