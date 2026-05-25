import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { success, error } from "@/lib/response";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();

    const { postId } = await params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) throw new NotFoundError("帖子");

    await prisma.post.delete({ where: { id: postId } });
    return success(null, "删除成功");
  } catch (err) {
    return error(err);
  }
}
