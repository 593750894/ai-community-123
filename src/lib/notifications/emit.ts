import { prisma } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma/client";

/**
 * 通知触发层
 *
 * 统一入口：emitNotification —— 自动跳过"自己操作自己"，并对同 actor + 同 target + 同 type
 * 在 24h 内做去重，避免反复点赞反复刷屏。
 *
 * 业务侧调用 `notifyXxx` 包装函数；任何失败都吞掉，不阻塞主流程。
 */

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

const DEDUP_TYPES: Set<NotificationType> = new Set([
  "POST_LIKE",
  "WORK_LIKE",
  "COMMENT_LIKE",
  "BOOKMARK",
  "FOLLOW",
  "MENTION",
]);

export interface EmitNotificationInput {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  targetType?: string | null;
  targetId?: string | null;
}

export async function emitNotification(input: EmitNotificationInput) {
  try {
    const { recipientId, actorId, type, title, body, link, targetType, targetId } = input;

    if (actorId && actorId === recipientId) return null;

    if (DEDUP_TYPES.has(type) && actorId && targetType && targetId) {
      const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
      const existing = await prisma.notification.findFirst({
        where: {
          userId: recipientId,
          actorId,
          type,
          targetType,
          targetId,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (existing) return null;
    }

    return await prisma.notification.create({
      data: {
        userId: recipientId,
        actorId: actorId ?? null,
        type,
        title,
        body: body ?? null,
        link: link ?? null,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
      },
      select: { id: true },
    });
  } catch (err) {
    console.error("[notifications] emit failed", err);
    return null;
  }
}

async function actorDisplay(actorId: string) {
  return prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true, username: true },
  });
}

/** 点赞帖子 → 通知作者 */
export async function notifyPostLike(args: { postId: string; actorId: string }) {
  try {
    const [post, actor] = await Promise.all([
      prisma.post.findUnique({
        where: { id: args.postId },
        select: { authorId: true, title: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!post || !actor) return;
    await emitNotification({
      recipientId: post.authorId,
      actorId: args.actorId,
      type: "POST_LIKE",
      title: `${actor.name} 赞了你的帖子`,
      body: post.title,
      link: `/post/${args.postId}`,
      targetType: "POST",
      targetId: args.postId,
    });
  } catch (err) {
    console.error("[notifications] notifyPostLike", err);
  }
}

/** 点赞作品 → 通知作者 */
export async function notifyWorkLike(args: { workId: string; actorId: string }) {
  try {
    const [work, actor] = await Promise.all([
      prisma.work.findUnique({
        where: { id: args.workId },
        select: { authorId: true, title: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!work || !actor) return;
    await emitNotification({
      recipientId: work.authorId,
      actorId: args.actorId,
      type: "WORK_LIKE",
      title: `${actor.name} 赞了你的作品`,
      body: work.title,
      link: `/showcase/${args.workId}`,
      targetType: "WORK",
      targetId: args.workId,
    });
  } catch (err) {
    console.error("[notifications] notifyWorkLike", err);
  }
}

/** 收藏帖子 → 通知作者 */
export async function notifyPostBookmark(args: { postId: string; actorId: string }) {
  try {
    const [post, actor] = await Promise.all([
      prisma.post.findUnique({
        where: { id: args.postId },
        select: { authorId: true, title: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!post || !actor) return;
    await emitNotification({
      recipientId: post.authorId,
      actorId: args.actorId,
      type: "BOOKMARK",
      title: `${actor.name} 收藏了你的帖子`,
      body: post.title,
      link: `/post/${args.postId}`,
      targetType: "POST",
      targetId: args.postId,
    });
  } catch (err) {
    console.error("[notifications] notifyPostBookmark", err);
  }
}

/** 收藏作品 → 通知作者 */
export async function notifyWorkBookmark(args: { workId: string; actorId: string }) {
  try {
    const [work, actor] = await Promise.all([
      prisma.work.findUnique({
        where: { id: args.workId },
        select: { authorId: true, title: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!work || !actor) return;
    await emitNotification({
      recipientId: work.authorId,
      actorId: args.actorId,
      type: "BOOKMARK",
      title: `${actor.name} 收藏了你的作品`,
      body: work.title,
      link: `/showcase/${args.workId}`,
      targetType: "WORK",
      targetId: args.workId,
    });
  } catch (err) {
    console.error("[notifications] notifyWorkBookmark", err);
  }
}

/** 点赞评论 → 通知评论作者 */
export async function notifyCommentLike(args: {
  commentId: string;
  actorId: string;
}) {
  try {
    const [comment, actor] = await Promise.all([
      prisma.comment.findUnique({
        where: { id: args.commentId },
        select: { authorId: true, content: true, postId: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!comment || !actor) return;
    await emitNotification({
      recipientId: comment.authorId,
      actorId: args.actorId,
      type: "COMMENT_LIKE",
      title: `${actor.name} 赞了你的评论`,
      body: comment.content.slice(0, 80),
      link: `/post/${comment.postId}#comment-${args.commentId}`,
      targetType: "COMMENT",
      targetId: args.commentId,
    });
  } catch (err) {
    console.error("[notifications] notifyCommentLike", err);
  }
}

/** 帖子被评论 → 通知作者；若评论是 reply（parentId 存在），同时通知被回复的人 */
export async function notifyPostReply(args: {
  postId: string;
  commentId: string;
  parentCommentId?: string | null;
  actorId: string;
}) {
  try {
    const [post, actor] = await Promise.all([
      prisma.post.findUnique({
        where: { id: args.postId },
        select: { authorId: true, title: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!post || !actor) return;

    await emitNotification({
      recipientId: post.authorId,
      actorId: args.actorId,
      type: "POST_REPLY",
      title: `${actor.name} 评论了你的帖子`,
      body: post.title,
      link: `/post/${args.postId}#comment-${args.commentId}`,
      targetType: "POST",
      targetId: args.postId,
    });

    if (args.parentCommentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: args.parentCommentId },
        select: { authorId: true, content: true, postId: true },
      });
      if (parent && parent.authorId !== post.authorId) {
        await emitNotification({
          recipientId: parent.authorId,
          actorId: args.actorId,
          type: "COMMENT_REPLY",
          title: `${actor.name} 回复了你的评论`,
          body: parent.content.slice(0, 80),
          link: `/post/${args.postId}#comment-${args.commentId}`,
          targetType: "COMMENT",
          targetId: args.parentCommentId,
        });
      }
    }
  } catch (err) {
    console.error("[notifications] notifyPostReply", err);
  }
}

/** 被关注 → 通知被关注的人 */
export async function notifyFollow(args: {
  followingId: string;
  actorId: string;
}) {
  try {
    const actor = await actorDisplay(args.actorId);
    if (!actor) return;
    await emitNotification({
      recipientId: args.followingId,
      actorId: args.actorId,
      type: "FOLLOW",
      title: `${actor.name} 关注了你`,
      body: null,
      link: `/profile/${args.actorId}`,
      targetType: "USER",
      targetId: args.actorId,
    });
  } catch (err) {
    console.error("[notifications] notifyFollow", err);
  }
}

/** 私信 → 通知会话中所有非发送者的参与者 */
export async function notifyMessage(args: {
  conversationId: string;
  messageId: string;
  actorId: string;
  preview: string;
}) {
  try {
    const [participants, actor] = await Promise.all([
      prisma.conversationParticipant.findMany({
        where: { conversationId: args.conversationId },
        select: { userId: true },
      }),
      actorDisplay(args.actorId),
    ]);
    if (!actor) return;

    const recipients = participants
      .map((p) => p.userId)
      .filter((id) => id !== args.actorId);

    await Promise.all(
      recipients.map((recipientId) =>
        emitNotification({
          recipientId,
          actorId: args.actorId,
          type: "MESSAGE",
          title: `${actor.name} 给你发了一条私信`,
          body: args.preview.slice(0, 80),
          link: `/messages/${args.conversationId}`,
          targetType: "CONVERSATION",
          targetId: args.conversationId,
        }),
      ),
    );
  } catch (err) {
    console.error("[notifications] notifyMessage", err);
  }
}
