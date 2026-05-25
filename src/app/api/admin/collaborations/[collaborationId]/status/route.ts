import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";

const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ collaborationId: string }> },
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();

    const { collaborationId } = await params;
    const body = await request.json();
    const { status } = body;

    if (
      typeof status !== "string" ||
      !(VALID_STATUSES as readonly string[]).includes(status)
    ) {
      throw new ValidationError("状态值不合法", {
        status: [`状态必须是 ${VALID_STATUSES.join(" / ")} 之一`],
      });
    }

    const collab = await prisma.collaboration.findUnique({
      where: { id: collaborationId },
      select: { id: true },
    });
    if (!collab) throw new NotFoundError("合作需求");

    const updated = await prisma.collaboration.update({
      where: { id: collaborationId },
      data: { status: status as (typeof VALID_STATUSES)[number] },
      include: {
        author: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });

    return success(updated, "状态更新成功");
  } catch (err) {
    return error(err);
  }
}
