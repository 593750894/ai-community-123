import { prisma } from "@/lib/db";
import type { Notification, NotificationType } from "@/generated/prisma/client";

export interface NotificationActor {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  targetType: string | null;
  targetId: string | null;
  readAt: Date | null;
  createdAt: Date;
  actor: NotificationActor | null;
}

export interface NotificationListResult {
  items: NotificationItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function mapNotification(
  n: Notification & {
    actor: NotificationActor | null;
  },
): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    targetType: n.targetType,
    targetId: n.targetId,
    readAt: n.readAt,
    createdAt: n.createdAt,
    actor: n.actor,
  };
}

/** 游标分页：cursor 是上一页最后一条的 id；按 createdAt desc 取下一页。 */
export async function listNotifications(args: {
  userId: string;
  cursor?: string | null;
  pageSize?: number;
  onlyUnread?: boolean;
}): Promise<NotificationListResult> {
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, args.pageSize ?? PAGE_SIZE),
  );

  const where = {
    userId: args.userId,
    ...(args.onlyUnread ? { readAt: null } : {}),
  };

  const rows = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: pageSize + 1,
    ...(args.cursor
      ? { skip: 1, cursor: { id: args.cursor } }
      : {}),
    include: {
      actor: {
        select: { id: true, name: true, username: true, avatar: true },
      },
    },
  });

  const hasMore = rows.length > pageSize;
  const sliced = hasMore ? rows.slice(0, pageSize) : rows;

  return {
    items: sliced.map(mapNotification),
    nextCursor: hasMore ? sliced[sliced.length - 1].id : null,
    hasMore,
  };
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

export async function markNotificationRead(args: {
  userId: string;
  notificationId: string;
}): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id: args.notificationId, userId: args.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
