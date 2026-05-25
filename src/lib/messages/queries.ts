import { prisma } from "@/lib/db";

export type ConversationListItem = {
  id: string;
  lastMessageAt: Date;
  unreadCount: number;
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: Date;
  } | null;
  otherUser: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    industryRole: string | null;
  } | null;
};

/**
 * 列出当前用户参与的所有会话，按最后消息时间倒序。
 * MVP 阶段只支持 1:1 私信，所以 otherUser 取第一个非自己的参与者。
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
        },
      },
    },
  });

  const items = await Promise.all(
    rows.map(async (c) => {
      const me = c.participants.find((p) => p.userId === userId);
      const other = c.participants.find((p) => p.userId !== userId);
      // 未读数 = 对方在「我上次阅读时间」之后发送的消息数
      const unreadCount = me
        ? await prisma.message.count({
            where: {
              conversationId: c.id,
              senderId: { not: userId },
              createdAt: { gt: me.lastReadAt },
            },
          })
        : 0;
      return {
        id: c.id,
        lastMessageAt: c.lastMessageAt,
        unreadCount,
        lastMessage: c.messages[0] ?? null,
        otherUser: other?.user ?? null,
      };
    }),
  );

  return items;
}

export type ConversationDetail = {
  id: string;
  otherUser: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    industryRole: string | null;
  } | null;
  messages: Array<{
    id: string;
    content: string;
    senderId: string;
    createdAt: Date;
  }>;
};

/**
 * 取一个会话的详情（仅当 userId 是参与者）。否则返回 null。
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
        },
      },
    },
  });
  if (!conv) return null;
  const other = conv.participants.find((p) => p.userId !== userId);
  return {
    id: conv.id,
    otherUser: other?.user ?? null,
    messages: conv.messages,
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
      })),
    },
  });
}
