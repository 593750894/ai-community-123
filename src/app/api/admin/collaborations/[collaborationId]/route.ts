import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { success, error } from "@/lib/response";

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
      select: { id: true },
    });
    if (!collab) throw new NotFoundError("合作需求");

    await prisma.collaboration.delete({ where: { id: collaborationId } });
    return success(null, "删除成功");
  } catch (err) {
    return error(err);
  }
}
