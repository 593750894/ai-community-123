import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { UpdateToolSchema } from "@/schemas/tool.schema";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ toolId: string }> },
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();

    const { toolId } = await params;

    const tool = await prisma.tool.findUnique({
      where: { id: toolId },
      select: { id: true },
    });
    if (!tool) throw new NotFoundError("工具");

    const body = await request.json();
    const parsed = UpdateToolSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const data = parsed.data;
    const updated = await prisma.tool.update({
      where: { id: toolId },
      data,
      include: {
        createdBy: {
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
  { params }: { params: Promise<{ toolId: string }> },
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();

    const { toolId } = await params;

    const tool = await prisma.tool.findUnique({
      where: { id: toolId },
      select: { id: true },
    });
    if (!tool) throw new NotFoundError("工具");

    await prisma.tool.delete({ where: { id: toolId } });
    return success(null, "删除成功");
  } catch (err) {
    return error(err);
  }
}
