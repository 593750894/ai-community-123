import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { createAuditLog } from "@/lib/admin/audit";

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
      },
    });
    if (!comment) throw new NotFoundError("评论");
    const isOwner = comment.authorId === user.id;
    const isAdmin = user.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      throw new ForbiddenError();
    }

    await prisma.$transaction([
      prisma.comment.delete({ where: { id: commentId } }),
      prisma.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);

    // Admin 删除评论 → 写审计（即便是 Admin 删自己的评论，也是后台动作，统一记录）
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
          selfDelete: isOwner,
        },
      });
    }

    return success(null, "删除成功");
  } catch (err) {
    return error(err);
  }
}
