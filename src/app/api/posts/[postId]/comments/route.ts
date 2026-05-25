import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { success, created, error } from "@/lib/response";
import { CreateCommentBodySchema } from "@/lib/comments/schemas";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const { postId } = await params;
    const url = new URL(request.url);
    const { page, pageSize, skip } = parsePagination(url);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!post) throw new NotFoundError("帖子");

    const where = { postId };

    const [items, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip,
        take: pageSize,
        include: {
          author: {
            select: { id: true, username: true, name: true, avatar: true },
          },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    return success(paginatedResponse(items, total, page, pageSize));
  } catch (err) {
    return error(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const user = await requireAuth();
    const { postId } = await params;

    const body = await request.json();
    const parsed = CreateCommentBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, locked: true },
    });
    if (!post) throw new NotFoundError("帖子");
    if (post.locked) {
      throw new ValidationError("该帖子已被锁定，无法评论");
    }

    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: {
          postId,
          authorId: user.id,
          content: parsed.data.content,
        },
        include: {
          author: {
            select: { id: true, username: true, name: true, avatar: true },
          },
        },
      }),
      prisma.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      }),
    ]);

    return created(comment, "评论成功");
  } catch (err) {
    return error(err);
  }
}
