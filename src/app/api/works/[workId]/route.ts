import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { UpdateWorkSchema } from "@/lib/works/schemas";
import { softDeleteWork } from "@/lib/content/soft-delete";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workId: string }> },
) {
  try {
    const { workId } = await params;
    const work = await prisma.work.findUnique({
      where: { id: workId },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });
    if (!work) throw new NotFoundError("作品");
    // Stage 17.2：软删除作品对外不可见。
    if (work.deletedAt) throw new NotFoundError("作品");
    return success(work);
  } catch (err) {
    return error(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workId: string }> },
) {
  try {
    const user = await requireAuth();
    await requireActiveUser(user);
    const { workId } = await params;

    const work = await prisma.work.findUnique({
      where: { id: workId },
      select: { authorId: true },
    });
    if (!work) throw new NotFoundError("作品");
    if (work.authorId !== user.id && user.role !== "ADMIN") {
      throw new ForbiddenError();
    }

    const body = await request.json();
    const parsed = UpdateWorkSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const data = parsed.data;
    const updated = await prisma.work.update({
      where: { id: workId },
      data,
      include: {
        author: {
          select: { id: true, username: true, name: true, avatar: true },
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
  { params }: { params: Promise<{ workId: string }> },
) {
  try {
    const user = await requireAuth();
    const { workId } = await params;

    const work = await prisma.work.findUnique({
      where: { id: workId },
      select: { authorId: true, deletedAt: true },
    });
    if (!work) throw new NotFoundError("作品");
    const isOwner = work.authorId === user.id;
    const isAdmin = user.role === "ADMIN";
    if (!isOwner && !isAdmin) {
      throw new ForbiddenError();
    }

    // Stage 17.2：作者自删→硬删除；ADMIN 删除他人→软删除。
    if (isOwner) {
      if (work.deletedAt) {
        throw new ForbiddenError("已被下架的内容请通过申诉恢复或联系管理员");
      }
      await prisma.work.delete({ where: { id: workId } });
      return success(null, "删除成功");
    }
    await softDeleteWork(workId, { actorId: user.id, source: "admin" });
    return success(null, "已下架（已通知作者，可发起申诉）");
  } catch (err) {
    return error(err);
  }
}
