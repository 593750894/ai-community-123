import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { UpdateToolSchema } from "@/schemas/tool.schema";
import { createAuditLog } from "@/lib/admin/audit";

// Stage 9：admin tool PATCH —— 显式 reject slug 改动 + 落 AuditLog。
// 删除路由保留 Stage 5 行为；adminDeleteTool server action 已经落 audit，
// 这里再补一条避免直接调 API 的删除路径漏审。

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
      select: {
        id: true,
        slug: true,
        name: true,
        url: true,
        category: true,
        pricing: true,
        useCase: true,
        tags: true,
        isOfficial: true,
      },
    });
    if (!tool) throw new NotFoundError("工具");

    const body = await request.json();
    if (body && typeof body === "object" && "slug" in body) {
      throw new ValidationError("slug 是 routing key，不允许通过 API 修改");
    }
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

    await createAuditLog({
      adminId: user.id,
      action: "UPDATE_TOOL",
      targetType: "Tool",
      targetId: toolId,
      metadata: {
        slug: tool.slug,
        before: {
          name: tool.name,
          url: tool.url,
          category: tool.category,
          pricing: tool.pricing,
          useCase: tool.useCase,
          tags: tool.tags,
          isOfficial: tool.isOfficial,
        },
        after: data,
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
      select: { id: true, slug: true, name: true },
    });
    if (!tool) throw new NotFoundError("工具");

    await prisma.tool.delete({ where: { id: toolId } });
    await createAuditLog({
      adminId: user.id,
      action: "DELETE_TOOL",
      targetType: "Tool",
      targetId: toolId,
      metadata: { name: tool.name, slug: tool.slug },
    });
    return success(null, "删除成功");
  } catch (err) {
    return error(err);
  }
}
