import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { UpdatePostSchema } from "@/lib/posts/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const { postId } = await params;
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        channel: {
          select: { id: true, slug: true, name: true, icon: true, color: true },
        },
      },
    });
    if (!post) throw new NotFoundError("帖子");
    return success(post);
  } catch (err) {
    return error(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const user = await requireAuth();
    const { postId } = await params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw new NotFoundError("帖子");
    if (post.authorId !== user.id && user.role !== "ADMIN") {
      throw new ForbiddenError();
    }

    const body = await request.json();
    const parsed = UpdatePostSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const data = parsed.data;
    const updated = await prisma.post.update({
      where: { id: postId },
      data,
      include: {
        author: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        channel: {
          select: { id: true, slug: true, name: true, icon: true, color: true },
        },
      },
    });

    return success(updated, "更新成功");
  } catch (err) {
    return error(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const user = await requireAuth();
    const { postId } = await params;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });
    if (!post) throw new NotFoundError("帖子");
    if (post.authorId !== user.id && user.role !== "ADMIN") {
      throw new ForbiddenError();
    }

    await prisma.post.delete({ where: { id: postId } });
    return success(null, "删除成功");
  } catch (err) {
    return error(err);
  }
}
