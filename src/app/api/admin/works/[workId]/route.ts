import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { success, error } from "@/lib/response";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workId: string }> },
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();

    const { workId } = await params;

    const work = await prisma.work.findUnique({
      where: { id: workId },
      select: { id: true },
    });
    if (!work) throw new NotFoundError("作品");

    await prisma.work.delete({ where: { id: workId } });
    return success(null, "删除成功");
  } catch (err) {
    return error(err);
  }
}
