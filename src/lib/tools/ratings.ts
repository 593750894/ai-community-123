import { prisma } from "@/lib/db";

export interface ToolRatingUser {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
}

export interface ToolRatingItem {
  id: string;
  stars: number;
  comment: string | null;
  createdAt: Date;
  user: ToolRatingUser;
}

export interface ToolRatingListResult {
  items: ToolRatingItem[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface ToolRatingSummary {
  avgRating: number | null;
  ratingCount: number;
  /** 1-5 各档分布 */
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
}

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function clampPageSize(input?: number) {
  return Math.min(MAX_PAGE_SIZE, Math.max(1, input ?? PAGE_SIZE));
}

/**
 * 提交/更新评分。同一 (toolId, userId) 唯一约束，upsert 即可。
 * 写入后立即重算 tool 的 avgRating / ratingCount。
 */
export async function upsertToolRating(args: {
  toolId: string;
  userId: string;
  stars: number;
  comment?: string | null;
}): Promise<{ rating: ToolRatingItem; summary: ToolRatingSummary }> {
  const { toolId, userId, stars } = args;
  const comment = args.comment?.trim() ? args.comment.trim() : null;

  const result = await prisma.$transaction(async (tx) => {
    const saved = await tx.toolRating.upsert({
      where: { toolId_userId: { toolId, userId } },
      create: { toolId, userId, stars, comment },
      update: { stars, comment },
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });

    const agg = await tx.toolRating.aggregate({
      where: { toolId },
      _avg: { stars: true },
      _count: { _all: true },
    });

    await tx.tool.update({
      where: { id: toolId },
      data: {
        avgRating: agg._avg.stars,
        ratingCount: agg._count._all,
      },
    });

    return { saved, agg };
  });

  const histogram = await histogramFor(toolId);

  return {
    rating: {
      id: result.saved.id,
      stars: result.saved.stars,
      comment: result.saved.comment,
      createdAt: result.saved.createdAt,
      user: result.saved.user,
    },
    summary: {
      avgRating: result.agg._avg.stars,
      ratingCount: result.agg._count._all,
      histogram,
    },
  };
}

/** 删除当前用户对该工具的评分（用于"撤回"）。返回最新 summary。 */
export async function deleteToolRating(args: {
  toolId: string;
  userId: string;
}): Promise<ToolRatingSummary> {
  const { toolId, userId } = args;
  await prisma.$transaction(async (tx) => {
    await tx.toolRating
      .delete({
        where: { toolId_userId: { toolId, userId } },
      })
      .catch(() => null);

    const agg = await tx.toolRating.aggregate({
      where: { toolId },
      _avg: { stars: true },
      _count: { _all: true },
    });

    await tx.tool.update({
      where: { id: toolId },
      data: {
        avgRating: agg._avg.stars,
        ratingCount: agg._count._all,
      },
    });
  });

  return getToolRatingSummary(toolId);
}

/** 当前用户对该工具的既有评分（用于回填表单） */
export async function getViewerRating(args: {
  toolId: string;
  userId: string;
}): Promise<{ stars: number; comment: string | null } | null> {
  const row = await prisma.toolRating.findUnique({
    where: {
      toolId_userId: { toolId: args.toolId, userId: args.userId },
    },
    select: { stars: true, comment: true },
  });
  return row;
}

export async function getToolRatingSummary(
  toolId: string,
): Promise<ToolRatingSummary> {
  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
    select: { avgRating: true, ratingCount: true },
  });
  return {
    avgRating: tool?.avgRating ?? null,
    ratingCount: tool?.ratingCount ?? 0,
    histogram: await histogramFor(toolId),
  };
}

async function histogramFor(
  toolId: string,
): Promise<Record<1 | 2 | 3 | 4 | 5, number>> {
  const rows = await prisma.toolRating.groupBy({
    by: ["stars"],
    where: { toolId },
    _count: { _all: true },
  });
  const result: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  for (const r of rows) {
    const star = r.stars as 1 | 2 | 3 | 4 | 5;
    if (star >= 1 && star <= 5) result[star] = r._count._all;
  }
  return result;
}

/**
 * 列表：按 createdAt desc 游标分页。
 * 同时回填 total，方便页面展示"共 N 条评价"。
 */
export async function listToolRatings(args: {
  toolId: string;
  cursor?: string | null;
  pageSize?: number;
}): Promise<ToolRatingListResult> {
  const pageSize = clampPageSize(args.pageSize);
  const { toolId } = args;
  const cursor = args.cursor ?? null;

  let rows;
  try {
    rows = await prisma.toolRating.findMany({
      where: { toolId },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });
  } catch {
    // Invalid cursor — fall back to page 1
    rows = await prisma.toolRating.findMany({
      where: { toolId },
      orderBy: { createdAt: "desc" },
      take: pageSize + 1,
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });
  }

  const hasMore = rows.length > pageSize;
  const sliced = hasMore ? rows.slice(0, pageSize) : rows;

  const total = await prisma.toolRating.count({ where: { toolId } });

  return {
    items: sliced.map((r) => ({
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      createdAt: r.createdAt,
      user: r.user,
    })),
    nextCursor: hasMore ? sliced[sliced.length - 1].id : null,
    hasMore,
    total,
  };
}
