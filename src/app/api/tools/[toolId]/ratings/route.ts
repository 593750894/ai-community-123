import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import {
  listToolRatings,
  upsertToolRating,
  deleteToolRating,
} from "@/lib/tools/ratings";

const SubmitRatingSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().nullable(),
});

async function resolveTool(toolIdOrSlug: string) {
  const looksLikeCuid = /^c[a-z0-9]{20,}$/i.test(toolIdOrSlug);
  const tool = await prisma.tool.findFirst({
    where: looksLikeCuid
      ? { OR: [{ id: toolIdOrSlug }, { slug: toolIdOrSlug }] }
      : { slug: toolIdOrSlug },
    select: { id: true },
  });
  if (!tool) throw new NotFoundError("工具");
  return tool;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ toolId: string }> },
) {
  try {
    const { toolId } = await params;
    const tool = await resolveTool(toolId);

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const pageSizeRaw = url.searchParams.get("pageSize");
    const pageSize = pageSizeRaw ? Number(pageSizeRaw) : undefined;

    const result = await listToolRatings({
      toolId: tool.id,
      cursor,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
    });

    return success(result);
  } catch (err) {
    return error(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ toolId: string }> },
) {
  try {
    const user = await requireAuth();
    await requireActiveUser(user);
    const { toolId } = await params;
    const tool = await resolveTool(toolId);

    const body = await request.json();
    const parsed = SubmitRatingSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }

    const result = await upsertToolRating({
      toolId: tool.id,
      userId: user.id,
      stars: parsed.data.stars,
      comment: parsed.data.comment ?? null,
    });

    return success(result, "评分已保存");
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
    const { toolId } = await params;
    const tool = await resolveTool(toolId);

    const summary = await deleteToolRating({
      toolId: tool.id,
      userId: user.id,
    });
    return success({ summary }, "评分已撤回");
  } catch (err) {
    return error(err);
  }
}
