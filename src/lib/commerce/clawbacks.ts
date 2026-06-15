import "server-only";

import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { createAuditLog } from "@/lib/admin/audit";

/**
 * Stage 16.4：分润后退款追讨（ClawbackRequest）查询 + 状态变更。
 *
 * 表语义：PAID Payout 上发生退款时落一条，记录平台向卖家追回的应收。
 * 这里不实现「下次结算自动扣减」——MVP 由 ops 在 /admin/clawbacks 决策抵扣。
 */

export const CLAWBACK_STATUSES = [
  "PENDING",
  "DEDUCTED",
  "MANUAL",
  "WAIVED",
] as const;
export type ClawbackStatusValue = (typeof CLAWBACK_STATUSES)[number];

export const CLAWBACK_STATUS_LABEL: Record<ClawbackStatusValue, string> = {
  PENDING: "待处理",
  DEDUCTED: "已抵扣",
  MANUAL: "线下追回",
  WAIVED: "平台豁免",
};

export interface AdminClawbackRow {
  id: string;
  orderNo: string;
  amountCents: number;
  currency: string;
  status: ClawbackStatusValue;
  note: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  seller: { id: string; username: string; name: string };
  payout: { id: string; status: string; paidAt: Date | null };
  refund: { id: string; amountCents: number };
  resolvedBy: { id: string; username: string; name: string } | null;
}

export interface ClawbackOverview {
  pendingCount: number;
  pendingTotalCents: number;
  resolvedThisMonthCount: number;
}

export async function listClawbacksForAdmin(args: {
  status?: ClawbackStatusValue;
  page?: number;
  pageSize?: number;
}): Promise<{ items: AdminClawbackRow[]; total: number }> {
  const page = Math.max(1, args.page ?? 1);
  const pageSize = Math.min(100, args.pageSize ?? 25);
  const where = args.status ? { status: args.status } : {};
  const [items, total] = await Promise.all([
    prisma.clawbackRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: pageSize,
      skip: (page - 1) * pageSize,
      select: {
        id: true,
        orderNo: true,
        amountCents: true,
        currency: true,
        status: true,
        note: true,
        createdAt: true,
        resolvedAt: true,
        seller: { select: { id: true, username: true, name: true } },
        payout: { select: { id: true, status: true, paidAt: true } },
        refund: { select: { id: true, amountCents: true } },
        resolvedBy: { select: { id: true, username: true, name: true } },
      },
    }),
    prisma.clawbackRequest.count({ where }),
  ]);
  return { items: items as AdminClawbackRow[], total };
}

export async function getAdminClawbackOverview(): Promise<ClawbackOverview> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [pendingAgg, resolvedCount] = await Promise.all([
    prisma.clawbackRequest.aggregate({
      where: { status: "PENDING" },
      _count: { _all: true },
      _sum: { amountCents: true },
    }),
    prisma.clawbackRequest.count({
      where: {
        status: { in: ["DEDUCTED", "MANUAL", "WAIVED"] },
        resolvedAt: { gte: startOfMonth },
      },
    }),
  ]);

  return {
    pendingCount: pendingAgg._count._all,
    pendingTotalCents: pendingAgg._sum.amountCents ?? 0,
    resolvedThisMonthCount: resolvedCount,
  };
}

/**
 * 标记 clawback 状态。仅 PENDING → 终态合法；终态不可改回 PENDING（审计可读）。
 * note 必填于 DEDUCTED / MANUAL（ops 必须留下「抵扣到哪笔 / 线下怎么追回」上下文），
 * WAIVED 可不填理由（豁免无需细节）。
 */
export async function resolveClawback(args: {
  clawbackId: string;
  adminId: string;
  toStatus: "DEDUCTED" | "MANUAL" | "WAIVED";
  note?: string;
}): Promise<void> {
  const note = args.note?.trim() ?? "";
  if ((args.toStatus === "DEDUCTED" || args.toStatus === "MANUAL") && !note) {
    throw new ValidationError("DEDUCTED / MANUAL 必须填写备注");
  }

  const existing = await prisma.clawbackRequest.findUnique({
    where: { id: args.clawbackId },
    select: {
      id: true,
      status: true,
      orderNo: true,
      sellerId: true,
      amountCents: true,
      currency: true,
    },
  });
  if (!existing) throw new NotFoundError("clawback");
  if (existing.status !== "PENDING") {
    throw new ForbiddenError(`当前状态 ${existing.status}，不可再变更`);
  }

  await prisma.clawbackRequest.update({
    where: { id: args.clawbackId },
    data: {
      status: args.toStatus,
      note: note || null,
      resolvedAt: new Date(),
      resolvedById: args.adminId,
    },
  });

  await createAuditLog({
    adminId: args.adminId,
    action: `CLAWBACK_${args.toStatus}`,
    targetType: "ClawbackRequest",
    targetId: args.clawbackId,
    metadata: {
      clawbackId: args.clawbackId,
      orderNo: existing.orderNo,
      sellerId: existing.sellerId,
      amountCents: existing.amountCents,
      currency: existing.currency,
      toStatus: args.toStatus,
      note: note || null,
    },
  });
}
