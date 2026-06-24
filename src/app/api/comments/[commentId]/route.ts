import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { createAuditLog } from "@/lib/admin/audit";
import { softDeleteComment } from "@/lib/content/soft-delete";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  try {
    const user = await requireAuth();
    const { commentId } = await params;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
        postId: true,
        parentId: true,
        content: true,
        deletedAt: true,
      },
    });
    if (!comment) throw new NotFoundError("评论");
    const isOwner = comment.authorId === user.id;
    const isAdmin = user.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      throw new ForbiddenError();
    }

    // Stage 17.2：作者自删→硬删除；ADMIN 删除他人→软删除（落 deletedAt + 通知作者）。
    if (isOwner) {
      if (comment.deletedAt) {
        throw new ForbiddenError("已被下架的评论请通过申诉恢复或联系管理员");
      }
      await prisma.$transaction([
        prisma.comment.delete({ where: { id: commentId } }),
        prisma.post.update({
          where: { id: comment.postId },
          data: { commentCount: { decrement: 1 } },
        }),
      ]);
      // Admin 自删自己评论的审计（删自己内容 + 后台动作可追溯）。
      if (isAdmin) {
        await createAuditLog({
          adminId: user.id,
          action: "DELETE_COMMENT",
          targetType: "Comment",
          targetId: commentId,
          metadata: {
            postId: comment.postId,
            authorId: comment.authorId,
            parentId: comment.parentId,
            contentSnippet: comment.content.slice(0, 120),
            selfDelete: true,
          },
        });
      }
      return success(null, "删除成功");
    }
    // 非作者的 ADMIN → 软删除
    await softDeleteComment(commentId, { actorId: user.id, source: "admin" });
    return success(null, "已下架（已通知作者，可发起申诉）");
  } catch (err) {
    return error(err);
  }
}
