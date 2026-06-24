"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { requireActiveUserById, SuspendedError } from "@/lib/auth/suspension";
import {
  notifyCommentLike,
  notifyPostLike,
  notifyWorkLike,
  notifyPostBookmark,
  notifyWorkBookmark,
} from "@/lib/notifications/emit";

/** 把禁言态映射为 InteractionResult 失败结果（带原因 message）。其它错误向上抛。 */
async function ensureActiveOrInteractionFail(
  userId: string,
): Promise<InteractionResult | null> {
  try {
    await requireActiveUserById(userId);
    return null;
  } catch (err) {
    if (err instanceof SuspendedError) {
      return { ok: false, active: false, count: 0, message: err.message };
    }
    throw err;
  }
}

export type InteractionResult = {
  ok: boolean;
  /** 当前用户对目标的状态：是否处于点赞/收藏中 */
  active: boolean;
  /** 目标的最新计数 */
  count: number;
  /** 未登录时为 true，前端可据此引导到登录页 */
  needLogin?: boolean;
  /** 错误信息 */
  message?: string;
};

function needLoginResult(): InteractionResult {
  return { ok: false, active: false, count: 0, needLogin: true };
}

/**
 * 帖子点赞 toggle
 * - 已点过：取消点赞，likeCount - 1
 * - 未点过：创建 Like，likeCount + 1
 * 防重：依赖 likes 表 (userId, postId) 的 @@unique 约束
 */
export async function togglePostLike(postId: string): Promise<InteractionResult> {
  const session = await getSession();
  if (!session) return needLoginResult();

  const userId = session.userId;
  const blocked = await ensureActiveOrInteractionFail(userId);
  if (blocked) return blocked;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, channelId: true, deletedAt: true },
  });
  if (!post || post.deletedAt) {
    return { ok: false, active: false, count: 0, message: "帖子不存在或已被删除" };
  }

  const existing = await prisma.like.findUnique({
    where: { userId_postId: { userId, postId } },
    select: { id: true },
  });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.like.delete({ where: { id: existing.id } });
        return tx.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
      }
      await tx.like.create({ data: { userId, postId } });
      return tx.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
    });

    revalidatePath(`/post/${postId}`);
    revalidatePath(`/community/${post.channelId}`);

    if (!existing) {
      await notifyPostLike({ postId, actorId: userId });
    }

    return {
      ok: true,
      active: !existing,
      count: Math.max(0, updated.likeCount),
    };
  } catch (err) {
    // 并发：另一笔请求已经写入。把计数补正回最新值并返回成功。
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const fresh = await prisma.post.findUnique({
        where: { id: postId },
        select: { likeCount: true },
      });
      const stillLiked = await prisma.like.findUnique({
        where: { userId_postId: { userId, postId } },
        select: { id: true },
      });
      return {
        ok: true,
        active: Boolean(stillLiked),
        count: Math.max(0, fresh?.likeCount ?? 0),
      };
    }
    throw err;
  }
}

/**
 * 作品点赞 toggle
 */
export async function toggleWorkLike(workId: string): Promise<InteractionResult> {
  const session = await getSession();
  if (!session) return needLoginResult();

  const userId = session.userId;
  const blocked = await ensureActiveOrInteractionFail(userId);
  if (blocked) return blocked;

  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: { id: true, deletedAt: true },
  });
  if (!work || work.deletedAt) {
    return { ok: false, active: false, count: 0, message: "作品不存在或已被删除" };
  }

  const existing = await prisma.like.findUnique({
    where: { userId_workId: { userId, workId } },
    select: { id: true },
  });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.like.delete({ where: { id: existing.id } });
        return tx.work.update({
          where: { id: workId },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
      }
      await tx.like.create({ data: { userId, workId } });
      return tx.work.update({
        where: { id: workId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
    });

    revalidatePath(`/showcase/${workId}`);
    revalidatePath("/showcase");

    if (!existing) {
      await notifyWorkLike({ workId, actorId: userId });
    }

    return {
      ok: true,
      active: !existing,
      count: Math.max(0, updated.likeCount),
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const fresh = await prisma.work.findUnique({
        where: { id: workId },
        select: { likeCount: true },
      });
      const stillLiked = await prisma.like.findUnique({
        where: { userId_workId: { userId, workId } },
        select: { id: true },
      });
      return {
        ok: true,
        active: Boolean(stillLiked),
        count: Math.max(0, fresh?.likeCount ?? 0),
      };
    }
    throw err;
  }
}

/**
 * 评论点赞 toggle
 * - 已点过：取消，likeCount - 1
 * - 未点过：创建 Like，likeCount + 1
 * 防重：依赖 likes 表 (userId, commentId) 的 @@unique 约束
 */
export async function toggleCommentLike(
  commentId: string,
): Promise<InteractionResult> {
  const session = await getSession();
  if (!session) return needLoginResult();

  const userId = session.userId;
  const blocked = await ensureActiveOrInteractionFail(userId);
  if (blocked) return blocked;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, authorId: true, deletedAt: true },
  });
  if (!comment || comment.deletedAt) {
    return { ok: false, active: false, count: 0, message: "评论不存在或已被删除" };
  }

  const existing = await prisma.like.findUnique({
    where: { userId_commentId: { userId, commentId } },
    select: { id: true },
  });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.like.delete({ where: { id: existing.id } });
        return tx.comment.update({
          where: { id: commentId },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
      }
      await tx.like.create({ data: { userId, commentId } });
      return tx.comment.update({
        where: { id: commentId },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
    });

    revalidatePath(`/post/${comment.postId}`);

    if (!existing) {
      await notifyCommentLike({ commentId, actorId: userId });
    }

    return {
      ok: true,
      active: !existing,
      count: Math.max(0, updated.likeCount),
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const fresh = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { likeCount: true },
      });
      const stillLiked = await prisma.like.findUnique({
        where: { userId_commentId: { userId, commentId } },
        select: { id: true },
      });
      return {
        ok: true,
        active: Boolean(stillLiked),
        count: Math.max(0, fresh?.likeCount ?? 0),
      };
    }
    throw err;
  }
}

/**
 * 帖子收藏 toggle
 * 帖子表没有 bookmarkCount 字段，前端展示用 Bookmark 是否存在即可。
 */
export async function togglePostBookmark(
  postId: string,
): Promise<InteractionResult> {
  const session = await getSession();
  if (!session) return needLoginResult();

  const userId = session.userId;
  const blocked = await ensureActiveOrInteractionFail(userId);
  if (blocked) return blocked;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, channelId: true, deletedAt: true },
  });
  if (!post || post.deletedAt) {
    return { ok: false, active: false, count: 0, message: "帖子不存在或已被删除" };
  }

  const existing = await prisma.bookmark.findUnique({
    where: { userId_postId: { userId, postId } },
    select: { id: true },
  });

  try {
    if (existing) {
      await prisma.bookmark.delete({ where: { id: existing.id } });
    } else {
      await prisma.bookmark.create({ data: { userId, postId } });
    }
    revalidatePath(`/post/${postId}`);
    revalidatePath(`/community/${post.channelId}`);
    if (!existing) {
      await notifyPostBookmark({ postId, actorId: userId });
    }
    return { ok: true, active: !existing, count: 0 };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const stillBookmarked = await prisma.bookmark.findUnique({
        where: { userId_postId: { userId, postId } },
        select: { id: true },
      });
      return { ok: true, active: Boolean(stillBookmarked), count: 0 };
    }
    throw err;
  }
}

/**
 * 作品收藏 toggle
 * 作品表有 bookmarkCount，维护它
 */
export async function toggleWorkBookmark(
  workId: string,
): Promise<InteractionResult> {
  const session = await getSession();
  if (!session) return needLoginResult();

  const userId = session.userId;
  const blocked = await ensureActiveOrInteractionFail(userId);
  if (blocked) return blocked;

  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: { id: true, deletedAt: true },
  });
  if (!work || work.deletedAt) {
    return { ok: false, active: false, count: 0, message: "作品不存在或已被删除" };
  }

  const existing = await prisma.bookmark.findUnique({
    where: { userId_workId: { userId, workId } },
    select: { id: true },
  });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.bookmark.delete({ where: { id: existing.id } });
        return tx.work.update({
          where: { id: workId },
          data: { bookmarkCount: { decrement: 1 } },
          select: { bookmarkCount: true },
        });
      }
      await tx.bookmark.create({ data: { userId, workId } });
      return tx.work.update({
        where: { id: workId },
        data: { bookmarkCount: { increment: 1 } },
        select: { bookmarkCount: true },
      });
    });

    revalidatePath(`/showcase/${workId}`);
    revalidatePath("/showcase");

    if (!existing) {
      await notifyWorkBookmark({ workId, actorId: userId });
    }

    return {
      ok: true,
      active: !existing,
      count: Math.max(0, updated.bookmarkCount),
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const fresh = await prisma.work.findUnique({
        where: { id: workId },
        select: { bookmarkCount: true },
      });
      const stillBookmarked = await prisma.bookmark.findUnique({
        where: { userId_workId: { userId, workId } },
        select: { id: true },
      });
      return {
        ok: true,
        active: Boolean(stillBookmarked),
        count: Math.max(0, fresh?.bookmarkCount ?? 0),
      };
    }
    throw err;
  }
}
