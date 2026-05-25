import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { UpdateWorkSchema } from "@/lib/works/schemas";

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
      select: { authorId: true },
    });
    if (!work) throw new NotFoundError("作品");
    if (work.authorId !== user.id && user.role !== "ADMIN") {
      throw new ForbiddenError();
    }

    await prisma.work.delete({ where: { id: workId } });
    return success(null, "删除成功");
  } catch (err) {
    return error(err);
  }
}
