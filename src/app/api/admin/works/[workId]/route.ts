import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { createAuditLog } from "@/lib/admin/audit";

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
      select: { id: true, title: true, authorId: true },
    });
    if (!work) throw new NotFoundError("作品");

    await prisma.work.delete({ where: { id: workId } });
    await createAuditLog({
      adminId: user.id,
      action: "DELETE_WORK",
      targetType: "Work",
      targetId: workId,
      metadata: { title: work.title, authorId: work.authorId },
    });
    return success(null, "删除成功");
  } catch (err) {
    return error(err);
  }
}
