import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { createAuditLog } from "@/lib/admin/audit";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ collaborationId: string }> },
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();

    const { collaborationId } = await params;

    const collab = await prisma.collaboration.findUnique({
      where: { id: collaborationId },
      select: { id: true, title: true, authorId: true, status: true },
    });
    if (!collab) throw new NotFoundError("合作需求");

    await prisma.collaboration.delete({ where: { id: collaborationId } });
    await createAuditLog({
      adminId: user.id,
      action: "DELETE_COLLAB",
      targetType: "Collaboration",
      targetId: collaborationId,
      metadata: {
        title: collab.title,
        authorId: collab.authorId,
        statusBefore: collab.status,
      },
    });
    return success(null, "删除成功");
  } catch (err) {
    return error(err);
  }
}
