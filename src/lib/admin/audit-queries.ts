import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/db";

// Stage 9：audit-logs 列表读层。指数支撑：
//  - (adminId, createdAt)   → 按操作人筛
//  - (action, createdAt)    → 按动作筛
//  - (targetType, targetId) → 按目标筛
// 命中其中一个就能扫描，全表 OR 时退化到 seq scan，但 admin 数据量小，可接受。

export interface AuditLogListItem {
  id: string;
  adminId: string;
  admin: {
    id: string;
    name: string;
    username: string;
  } | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface ListAuditLogsArgs {
  adminUsername?: string;
  action?: string;
  targetType?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export interface ListAuditLogsResult {
  items: AuditLogListItem[];
  total: number;
}

export async function listAuditLogs(
  args: ListAuditLogsArgs,
): Promise<ListAuditLogsResult> {
  const where: Prisma.AuditLogWhereInput = {};

  if (args.action) where.action = args.action;
  if (args.targetType) where.targetType = args.targetType;
  if (args.from || args.to) {
    where.createdAt = {};
    if (args.from) where.createdAt.gte = args.from;
    if (args.to) where.createdAt.lte = args.to;
  }
  if (args.adminUsername) {
    where.admin = {
      OR: [
        { username: { contains: args.adminUsername, mode: "insensitive" } },
        { name: { contains: args.adminUsername, mode: "insensitive" } },
      ],
    };
  }

  const skip = (Math.max(1, args.page) - 1) * args.pageSize;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: args.pageSize,
      include: {
        admin: { select: { id: true, name: true, username: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const items: AuditLogListItem[] = rows.map((r) => ({
    id: r.id,
    adminId: r.adminId,
    admin: r.admin,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    ip: r.ip,
    userAgent: r.userAgent,
    createdAt: r.createdAt,
  }));

  return { items, total };
}
