import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/db";

import {
  REPORT_TARGET_LABEL,
  type ReportStatusValue,
  type ReportTargetTypeValue,
} from "@/lib/reports/schemas";

/**
 * 举报列表查询。
 *
 * 列表面板需要看到：举报人、目标类型、目标内容预览（标题 / 评论摘要 / 用户名…）、
 * 原因、状态、时间。预览查询按 targetType 分桶批量做，避免 N+1。
 */

export type ReportListItem = {
  id: string;
  reporterId: string;
  reporter: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
  };
  targetType: ReportTargetTypeValue;
  targetId: string;
  targetLabel: string;
  targetPreview: string | null;
  targetLink: string | null;
  reason: string;
  description: string | null;
  status: ReportStatusValue;
  resolvedById: string | null;
  resolvedBy: {
    id: string;
    name: string;
    username: string;
  } | null;
  resolvedAt: Date | null;
  resolution: string | null;
  // Stage 17.1：MOD 队列认领
  assignedToId: string | null;
  assignedTo: {
    id: string;
    name: string;
    username: string;
  } | null;
  assignedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface ListReportsArgs {
  status?: ReportStatusValue;
  targetType?: ReportTargetTypeValue;
  /** Stage 17.1：仅返回该 MOD 认领的举报（"我处理的" filter）。 */
  assignedToId?: string;
  page: number;
  pageSize: number;
}

export interface ListReportsResult {
  items: ReportListItem[];
  total: number;
}

async function loadTargetPreviews(
  rows: Array<{ targetType: ReportTargetTypeValue; targetId: string }>,
): Promise<Map<string, { preview: string | null; link: string | null }>> {
  const map = new Map<string, { preview: string | null; link: string | null }>();
  const byType = new Map<ReportTargetTypeValue, Set<string>>();
  for (const r of rows) {
    if (!byType.has(r.targetType)) byType.set(r.targetType, new Set());
    byType.get(r.targetType)!.add(r.targetId);
  }

  const tasks: Promise<void>[] = [];
  for (const [type, ids] of byType) {
    const idList = Array.from(ids);
    if (type === "POST") {
      tasks.push(
        prisma.post
          .findMany({
            where: { id: { in: idList } },
            select: { id: true, title: true },
          })
          .then((posts) => {
            for (const p of posts) {
              map.set(`POST:${p.id}`, {
                preview: p.title,
                link: `/post/${p.id}`,
              });
            }
          }),
      );
    } else if (type === "COMMENT") {
      tasks.push(
        prisma.comment
          .findMany({
            where: { id: { in: idList } },
            select: { id: true, content: true, postId: true },
          })
          .then((cs) => {
            for (const c of cs) {
              map.set(`COMMENT:${c.id}`, {
                preview: c.content.slice(0, 80),
                link: `/post/${c.postId}#comment-${c.id}`,
              });
            }
          }),
      );
    } else if (type === "WORK") {
      tasks.push(
        prisma.work
          .findMany({
            where: { id: { in: idList } },
            select: { id: true, title: true },
          })
          .then((ws) => {
            for (const w of ws) {
              map.set(`WORK:${w.id}`, {
                preview: w.title,
                link: `/showcase/${w.id}`,
              });
            }
          }),
      );
    } else if (type === "COLLABORATION") {
      tasks.push(
        prisma.collaboration
          .findMany({
            where: { id: { in: idList } },
            select: { id: true, title: true },
          })
          .then((cs) => {
            for (const c of cs) {
              map.set(`COLLABORATION:${c.id}`, {
                preview: c.title,
                link: `/collaboration/${c.id}`,
              });
            }
          }),
      );
    } else if (type === "USER") {
      tasks.push(
        prisma.user
          .findMany({
            where: { id: { in: idList } },
            select: { id: true, name: true, username: true },
          })
          .then((us) => {
            for (const u of us) {
              map.set(`USER:${u.id}`, {
                preview: `${u.name} @${u.username}`,
                link: `/profile/${u.id}`,
              });
            }
          }),
      );
    } else if (type === "TOOL") {
      tasks.push(
        prisma.tool
          .findMany({
            where: { id: { in: idList } },
            select: { id: true, name: true, slug: true },
          })
          .then((ts) => {
            for (const t of ts) {
              map.set(`TOOL:${t.id}`, {
                preview: t.name,
                link: `/tools/${t.slug}`,
              });
            }
          }),
      );
    }
    // MESSAGE 暂无独立详情页，preview/link 保持 null
  }
  await Promise.all(tasks);
  return map;
}

export async function listReports(
  args: ListReportsArgs,
): Promise<ListReportsResult> {
  const where: Prisma.ReportWhereInput = {};
  if (args.status) where.status = args.status;
  if (args.targetType) where.targetType = args.targetType;
  if (args.assignedToId) where.assignedToId = args.assignedToId;

  const skip = (Math.max(1, args.page) - 1) * args.pageSize;

  const [rows, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: args.pageSize,
      include: {
        reporter: {
          select: { id: true, name: true, username: true, avatar: true },
        },
        resolvedBy: { select: { id: true, name: true, username: true } },
        assignedTo: { select: { id: true, name: true, username: true } },
      },
    }),
    prisma.report.count({ where }),
  ]);

  const previews = await loadTargetPreviews(
    rows.map((r) => ({
      targetType: r.targetType as ReportTargetTypeValue,
      targetId: r.targetId,
    })),
  );

  const items: ReportListItem[] = rows.map((r) => {
    const key = `${r.targetType}:${r.targetId}`;
    const preview = previews.get(key);
    return {
      id: r.id,
      reporterId: r.reporterId,
      reporter: r.reporter,
      targetType: r.targetType as ReportTargetTypeValue,
      targetId: r.targetId,
      targetLabel:
        REPORT_TARGET_LABEL[r.targetType as ReportTargetTypeValue] ??
        r.targetType,
      targetPreview: preview?.preview ?? null,
      targetLink: preview?.link ?? null,
      reason: r.reason,
      description: r.description,
      status: r.status as ReportStatusValue,
      resolvedById: r.resolvedById,
      resolvedBy: r.resolvedBy,
      resolvedAt: r.resolvedAt,
      resolution: r.resolution,
      assignedToId: r.assignedToId,
      assignedTo: r.assignedTo,
      assignedAt: r.assignedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });

  return { items, total };
}

export async function getReportById(
  reportId: string,
): Promise<ReportListItem | null> {
  const r = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: {
        select: { id: true, name: true, username: true, avatar: true },
      },
      resolvedBy: { select: { id: true, name: true, username: true } },
      assignedTo: { select: { id: true, name: true, username: true } },
    },
  });
  if (!r) return null;
  const previews = await loadTargetPreviews([
    { targetType: r.targetType as ReportTargetTypeValue, targetId: r.targetId },
  ]);
  const preview = previews.get(`${r.targetType}:${r.targetId}`);
  return {
    id: r.id,
    reporterId: r.reporterId,
    reporter: r.reporter,
    targetType: r.targetType as ReportTargetTypeValue,
    targetId: r.targetId,
    targetLabel:
      REPORT_TARGET_LABEL[r.targetType as ReportTargetTypeValue] ??
      r.targetType,
    targetPreview: preview?.preview ?? null,
    targetLink: preview?.link ?? null,
    reason: r.reason,
    description: r.description,
    status: r.status as ReportStatusValue,
    resolvedById: r.resolvedById,
    resolvedBy: r.resolvedBy,
    resolvedAt: r.resolvedAt,
    resolution: r.resolution,
    assignedToId: r.assignedToId,
    assignedTo: r.assignedTo,
    assignedAt: r.assignedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function countOpenReports(): Promise<number> {
  return prisma.report.count({
    where: { status: { in: ["PENDING", "REVIEWING"] } },
  });
}

/** Stage 17.1：当前 MOD 的活跃工作量（自己认领、未结案）。layout badge 用。 */
export async function countMyAssignedReports(modId: string): Promise<number> {
  return prisma.report.count({
    where: { assignedToId: modId, status: "REVIEWING" },
  });
}
