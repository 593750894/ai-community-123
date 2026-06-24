import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { UpdatePostSchema } from "@/lib/posts/schemas";
import { softDeletePost } from "@/lib/content/soft-delete";
import { assertNotBlocked } from "@/lib/content/blocked-words";

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
    // Stage 17.2：软删除帖子对外不可见（仅作者/admin 通过页面路径可达）。
    if (post.deletedAt) throw new NotFoundError("帖子");
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
    await requireActiveUser(user);
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
    // Stage 17.3：编辑路径同样过关键词黑名单——只检查请求里被改的字段，
    // 防御「先发干净帖子再 PATCH 塞违禁词」绕过创建期检查。
    if (data.title !== undefined || data.content !== undefined) {
      await assertNotBlocked(
        { scope: "POST", actorId: user.id, source: `post:patch:${postId}` },
        data.title,
        data.content,
      );
    }
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
      select: { authorId: true, deletedAt: true },
    });
    if (!post) throw new NotFoundError("帖子");
    const isOwner = post.authorId === user.id;
    const isAdmin = user.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      throw new ForbiddenError();
    }

    // Stage 17.2：作者自删 → 仍为硬删除（用户主动选择，无申诉对象）。
    // ADMIN 删除他人内容 → 软删除（落 deletedAt + 通知作者 + 提供申诉入口）。
    if (isOwner) {
      if (post.deletedAt) {
        // 自己的内容已被下架，作者无法再硬删（避免恶意「下架后再删」绕过审计）。
        throw new ForbiddenError("已被下架的内容请通过申诉恢复或联系管理员");
      }
      await prisma.post.delete({ where: { id: postId } });
      return success(null, "删除成功");
    }
    await softDeletePost(postId, { actorId: user.id, source: "admin" });
    return success(null, "已下架（已通知作者，可发起申诉）");
  } catch (err) {
    return error(err);
  }
}
