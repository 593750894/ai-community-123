import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import { success, error } from "@/lib/response";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  try {
    const user = await requireAuth();
    const { commentId } = await params;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, authorId: true, postId: true },
    });
    if (!comment) throw new NotFoundError("评论");
    if (comment.authorId !== user.id && user.role !== "ADMIN") {
      throw new ForbiddenError();
    }

    await prisma.$transaction([
      prisma.comment.delete({ where: { id: commentId } }),
      prisma.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      }),
    ]);

    return success(null, "删除成功");
  } catch (err) {
    return error(err);
  }
}
