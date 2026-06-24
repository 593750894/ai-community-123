import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { ToggleLikeSchema } from "@/lib/interactions/schemas";
import {
  notifyCommentLike,
  notifyPostLike,
  notifyWorkLike,
} from "@/lib/notifications/emit";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    await requireActiveUser(user);
    const body = await request.json();
    const parsed = ToggleLikeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const { targetType, targetId } = parsed.data;

    if (targetType === "COMMENT") {
      const comment = await prisma.comment.findUnique({
        where: { id: targetId },
        select: { id: true, deletedAt: true },
      });
      if (!comment || comment.deletedAt) throw new NotFoundError("评论");

      const existing = await prisma.like.findUnique({
        where: { userId_commentId: { userId: user.id, commentId: targetId } },
      });

      if (existing) {
        await prisma.$transaction([
          prisma.like.delete({ where: { id: existing.id } }),
          prisma.comment.update({
            where: { id: targetId },
            data: { likeCount: { decrement: 1 } },
          }),
        ]);
        return success({ liked: false });
      }

      await prisma.$transaction([
        prisma.like.create({
          data: { userId: user.id, commentId: targetId },
        }),
        prisma.comment.update({
          where: { id: targetId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);
      await notifyCommentLike({ commentId: targetId, actorId: user.id });
      return success({ liked: true });
    }

    if (targetType === "POST") {
      const post = await prisma.post.findUnique({
        where: { id: targetId },
        select: { id: true, deletedAt: true },
      });
      if (!post || post.deletedAt) throw new NotFoundError("帖子");

      const existing = await prisma.like.findUnique({
        where: { userId_postId: { userId: user.id, postId: targetId } },
      });

      if (existing) {
        await prisma.$transaction([
          prisma.like.delete({ where: { id: existing.id } }),
          prisma.post.update({
            where: { id: targetId },
            data: { likeCount: { decrement: 1 } },
          }),
        ]);
        return success({ liked: false });
      }

      await prisma.$transaction([
        prisma.like.create({
          data: { userId: user.id, postId: targetId },
        }),
        prisma.post.update({
          where: { id: targetId },
          data: { likeCount: { increment: 1 } },
        }),
      ]);
      await notifyPostLike({ postId: targetId, actorId: user.id });
      return success({ liked: true });
    }

    // targetType === "WORK"
    const work = await prisma.work.findUnique({
      where: { id: targetId },
      select: { id: true, deletedAt: true },
    });
    if (!work || work.deletedAt) throw new NotFoundError("作品");

    const existing = await prisma.like.findUnique({
      where: { userId_workId: { userId: user.id, workId: targetId } },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.like.delete({ where: { id: existing.id } }),
        prisma.work.update({
          where: { id: targetId },
          data: { likeCount: { decrement: 1 } },
        }),
      ]);
      return success({ liked: false });
    }

    await prisma.$transaction([
      prisma.like.create({
        data: { userId: user.id, workId: targetId },
      }),
      prisma.work.update({
        where: { id: targetId },
        data: { likeCount: { increment: 1 } },
      }),
    ]);
    await notifyWorkLike({ workId: targetId, actorId: user.id });
    return success({ liked: true });
  } catch (err) {
    return error(err);
  }
}
