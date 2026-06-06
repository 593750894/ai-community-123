import "server-only";

import { Prisma, prisma } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import {
  notifyPayoutAvailable,
  notifyPayoutPaid,
} from "@/lib/notifications/emit";

import type {
  PayoutMethodValue,
  PayoutStatusValue,
  UpdatePayoutAccountInput,
} from "./schemas";
import { PAYOUT_METHODS } from "./schemas";

/**
 * Stage 10.5：创作者结算单（Payout）业务层。
 *
 * 状态机：
 *   PENDING  ── finalizePendingPayouts cron ──▶ AVAILABLE
 *   AVAILABLE ── requestPayout（卖家点申请） ──▶ AVAILABLE + requestedAt
 *   AVAILABLE ── markPayoutPaid（admin 标记打款）──▶ PAID
 *   PENDING / AVAILABLE ── refundOrder（全额退款）──▶ CANCELED（refunds.ts 内做）
 *
 * 安全约束：
 *   - 卖家只能操作自己的 Payout（sellerId 校验）。
 *   - 提现申请前必须绑定收款账号（payoutMethod/payoutAccount/payoutName 全非空）。
 *   - admin 标记打款是「最终态」：PAID 不能回退；标记时快照收款账号（防 user 改账号导致历史错乱）。
 *   - finalize cron 用 updateMany WHERE status='PENDING' AND availableAt<=now，幂等；
 *     与并发的全额退款（status PENDING→CANCELED）天然互斥。
 */

// ──────────────────────────── 1. 收款账号绑定 ────────────────────────────

export interface PayoutAccountSummary {
  payoutMethod: PayoutMethodValue | null;
  payoutAccount: string | null;
  payoutName: string | null;
  hasAccount: boolean;
}

export async function getPayoutAccount(
  userId: string,
): Promise<PayoutAccountSummary> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { payoutMethod: true, payoutAccount: true, payoutName: true },
  });
  if (!user) throw new NotFoundError("用户");
  const method = (user.payoutMethod ?? null) as PayoutMethodValue | null;
  const account = user.payoutAccount;
  const name = user.payoutName;
  const hasAccount = Boolean(
    method &&
      (PAYOUT_METHODS as readonly string[]).includes(method) &&
      account &&
      name,
  );
  return {
    payoutMethod: method,
    payoutAccount: account,
    payoutName: name,
    hasAccount,
  };
}

export async function updatePayoutAccount(
  userId: string,
  input: UpdatePayoutAccountInput,
): Promise<PayoutAccountSummary> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      payoutMethod: input.payoutMethod,
      payoutAccount: input.payoutAccount,
      payoutName: input.payoutName,
    },
  });
  return getPayoutAccount(userId);
}

// ──────────────────────────── 2. 收益汇总（卖家视角） ────────────────────────────

export interface EarningsSummary {
  /** 当前是否绑定了收款账号。未绑定 → /me/earnings 引导填写。 */
  account: PayoutAccountSummary;
  /** PAID 订单聚合的卖家净额（按净额，cents），不含 CANCELED。 */
  totalNetCents: number;
  /** PAID 订单聚合的卖家毛额（订单金额，cents），用于显示「总成交」。 */
  totalGrossCents: number;
  /** PAID 订单聚合的平台抽成（cents），用于显示「平台抽成」。 */
  totalPlatformFeeCents: number;
  /** 各状态净额（cents）：PENDING=冷藏中、AVAILABLE=可提现、PAID=已结算、CANCELED=已取消。 */
  byStatus: Record<PayoutStatusValue, { netCents: number; count: number }>;
  /** 是否存在已申请提现（AVAILABLE + requestedAt 非空）。UI 用来禁用「申请提现」按钮。 */
  hasPendingRequest: boolean;
  /** 已申请提现的净额合计。 */
  pendingRequestNetCents: number;
  /** 当前生效的平台费率（基点）+ 冷藏期（天），UI 用来展示「按 XX% 抽成 · YY 天冷藏期」。 */
  platformFeeBps: number;
  payoutHoldDays: number;
}

import { PAYOUT_HOLD_DAYS, PLATFORM_FEE_BPS } from "./config";

export async function getEarningsSummary(
  sellerId: string,
): Promise<EarningsSummary> {
  const [account, grouped, requestedAgg] = await Promise.all([
    getPayoutAccount(sellerId),
    prisma.payout.groupBy({
      by: ["status"],
      where: { sellerId },
      _sum: {
        grossCents: true,
        platformFeeCents: true,
        netCents: true,
      },
      _count: { _all: true },
    }),
    prisma.payout.aggregate({
      where: {
        sellerId,
        status: "AVAILABLE",
        requestedAt: { not: null },
      },
      _sum: { netCents: true },
      _count: { _all: true },
    }),
  ]);

  const byStatus: EarningsSummary["byStatus"] = {
    PENDING: { netCents: 0, count: 0 },
    AVAILABLE: { netCents: 0, count: 0 },
    PAID: { netCents: 0, count: 0 },
    CANCELED: { netCents: 0, count: 0 },
  };

  let totalNetCents = 0;
  let totalGrossCents = 0;
  let totalPlatformFeeCents = 0;

  for (const row of grouped) {
    const key = row.status as PayoutStatusValue;
    const netSum = row._sum.netCents ?? 0;
    const grossSum = row._sum.grossCents ?? 0;
    const feeSum = row._sum.platformFeeCents ?? 0;
    if (key in byStatus) {
      byStatus[key] = { netCents: netSum, count: row._count._all };
    }
    // 「总收益」「平台抽成」「总成交」按业务定义只算 PAID / AVAILABLE / PENDING（即非 CANCELED）。
    // CANCELED 已退款回买家，从收益盘子里拿掉。
    if (key !== "CANCELED") {
      totalNetCents += netSum;
      totalGrossCents += grossSum;
      totalPlatformFeeCents += feeSum;
    }
  }

  return {
    account,
    totalNetCents,
    totalGrossCents,
    totalPlatformFeeCents,
    byStatus,
    hasPendingRequest: (requestedAgg._count._all ?? 0) > 0,
    pendingRequestNetCents: requestedAgg._sum.netCents ?? 0,
    platformFeeBps: PLATFORM_FEE_BPS,
    payoutHoldDays: PAYOUT_HOLD_DAYS,
  };
}

// ──────────────────────────── 3. 卖家自己的 Payout 列表 ────────────────────────────

export interface PayoutRow {
  id: string;
  orderId: string;
  orderNo: string;
  status: PayoutStatusValue;
  grossCents: number;
  platformFeeCents: number;
  netCents: number;
  currency: string;
  availableAt: Date;
  requestedAt: Date | null;
  paidAt: Date | null;
  paidNote: string | null;
  createdAt: Date;
  workflowItem: {
    id: string;
    title: string;
  } | null;
}

const PAYOUT_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNo: true,
      workflowItem: { select: { id: true, title: true } },
    },
  },
} satisfies Prisma.PayoutInclude;

type PayoutWithOrder = Prisma.PayoutGetPayload<{ include: typeof PAYOUT_INCLUDE }>;

function shape(p: PayoutWithOrder): PayoutRow {
  return {
    id: p.id,
    orderId: p.orderId,
    orderNo: p.order.orderNo,
    status: p.status as PayoutStatusValue,
    grossCents: p.grossCents,
    platformFeeCents: p.platformFeeCents,
    netCents: p.netCents,
    currency: p.currency,
    availableAt: p.availableAt,
    requestedAt: p.requestedAt,
    paidAt: p.paidAt,
    paidNote: p.paidNote,
    createdAt: p.createdAt,
    workflowItem: p.order.workflowItem ?? null,
  };
}

export interface ListMyPayoutsArgs {
  sellerId: string;
  status?: PayoutStatusValue;
  page: number;
  pageSize: number;
}

export interface ListMyPayoutsResult {
  items: PayoutRow[];
  total: number;
}

export async function listMyPayouts(
  args: ListMyPayoutsArgs,
): Promise<ListMyPayoutsResult> {
  const where: Prisma.PayoutWhereInput = { sellerId: args.sellerId };
  if (args.status) where.status = args.status;
  const skip = (Math.max(1, args.page) - 1) * args.pageSize;
  const [rows, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: PAYOUT_INCLUDE,
      skip,
      take: args.pageSize,
    }),
    prisma.payout.count({ where }),
  ]);
  return { items: rows.map(shape), total };
}

// ──────────────────────────── 4. Admin 视角 Payout 列表 ────────────────────────────

export interface AdminPayoutRow extends PayoutRow {
  seller: { id: string; name: string; username: string };
  /** 卖家当前绑定的收款账号；用于 admin 准备线下打款时核对。 */
  sellerAccount: PayoutAccountSummary;
}

const ADMIN_PAYOUT_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNo: true,
      workflowItem: { select: { id: true, title: true } },
    },
  },
  seller: {
    select: {
      id: true,
      name: true,
      username: true,
      payoutMethod: true,
      payoutAccount: true,
      payoutName: true,
    },
  },
} satisfies Prisma.PayoutInclude;

type AdminPayoutWithSeller = Prisma.PayoutGetPayload<{
  include: typeof ADMIN_PAYOUT_INCLUDE;
}>;

function shapeAdmin(p: AdminPayoutWithSeller): AdminPayoutRow {
  const method = (p.seller.payoutMethod ?? null) as PayoutMethodValue | null;
  const hasAccount = Boolean(
    method &&
      (PAYOUT_METHODS as readonly string[]).includes(method) &&
      p.seller.payoutAccount &&
      p.seller.payoutName,
  );
  return {
    id: p.id,
    orderId: p.orderId,
    orderNo: p.order.orderNo,
    status: p.status as PayoutStatusValue,
    grossCents: p.grossCents,
    platformFeeCents: p.platformFeeCents,
    netCents: p.netCents,
    currency: p.currency,
    availableAt: p.availableAt,
    requestedAt: p.requestedAt,
    paidAt: p.paidAt,
    paidNote: p.paidNote,
    createdAt: p.createdAt,
    workflowItem: p.order.workflowItem ?? null,
    seller: {
      id: p.seller.id,
      name: p.seller.name,
      username: p.seller.username,
    },
    sellerAccount: {
      payoutMethod: method,
      payoutAccount: p.seller.payoutAccount,
      payoutName: p.seller.payoutName,
      hasAccount,
    },
  };
}

export interface ListAdminPayoutsArgs {
  status?: PayoutStatusValue;
  /** true 仅显示已申请提现的 AVAILABLE 行（待处理队列）。 */
  pendingRequest?: boolean;
  /** 模糊匹配 seller name/username 或 orderNo 精确。 */
  q?: string;
  page: number;
  pageSize: number;
}

export interface ListAdminPayoutsResult {
  items: AdminPayoutRow[];
  total: number;
}

export async function listPayoutsForAdmin(
  args: ListAdminPayoutsArgs,
): Promise<ListAdminPayoutsResult> {
  const where: Prisma.PayoutWhereInput = {};
  if (args.status) where.status = args.status;
  if (args.pendingRequest) {
    where.status = "AVAILABLE";
    where.requestedAt = { not: null };
  }
  if (args.q) {
    where.OR = [
      { order: { orderNo: args.q } },
      {
        seller: {
          OR: [
            { username: { contains: args.q, mode: "insensitive" } },
            { name: { contains: args.q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }
  const skip = (Math.max(1, args.page) - 1) * args.pageSize;
  const [rows, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      orderBy: [
        // 待处理提现优先（requestedAt 非空 + 时间早的先排）
        { requestedAt: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      include: ADMIN_PAYOUT_INCLUDE,
      skip,
      take: args.pageSize,
    }),
    prisma.payout.count({ where }),
  ]);
  return { items: rows.map(shapeAdmin), total };
}

/** Admin 总览用：分状态金额聚合（cents）。 */
export interface AdminPayoutOverview {
  pendingNetCents: number;
  availableNetCents: number;
  requestedNetCents: number;
  paidNetCents: number;
  canceledNetCents: number;
  pendingRequestCount: number;
}

export async function getAdminPayoutOverview(): Promise<AdminPayoutOverview> {
  const [grouped, requested] = await Promise.all([
    prisma.payout.groupBy({
      by: ["status"],
      _sum: { netCents: true },
    }),
    prisma.payout.aggregate({
      where: { status: "AVAILABLE", requestedAt: { not: null } },
      _sum: { netCents: true },
      _count: { _all: true },
    }),
  ]);
  const sumOf = (s: string) =>
    grouped.find((g) => g.status === s)?._sum.netCents ?? 0;
  return {
    pendingNetCents: sumOf("PENDING"),
    availableNetCents: sumOf("AVAILABLE"),
    requestedNetCents: requested._sum.netCents ?? 0,
    paidNetCents: sumOf("PAID"),
    canceledNetCents: sumOf("CANCELED"),
    pendingRequestCount: requested._count._all ?? 0,
  };
}

// ──────────────────────────── 5. finalize PENDING → AVAILABLE（cron） ────────────────────────────

export interface FinalizePayoutsResult {
  finalized: number;
}

/**
 * 把冷藏期已结束的 PENDING 行批量转 AVAILABLE，并对每个卖家发一条 PAYOUT_AVAILABLE 通知。
 *
 * 幂等：updateMany WHERE status='PENDING' AND availableAt <= now。
 * 与全额退款竞态：refund 把 PENDING/AVAILABLE → CANCELED；同一行只会被一边赢到。
 *
 * 调用方：admin 手动 / cron `/api/cron/finalize-payouts`。
 */
export async function finalizePendingPayouts(args?: {
  /** 单次最大处理行数，默认 500。 */
  limit?: number;
  now?: Date;
}): Promise<FinalizePayoutsResult> {
  const limit = args?.limit ?? 500;
  const now = args?.now ?? new Date();

  // 先 find，updateMany WHERE id IN，避免大事务；通知按 sellerId 去重发送。
  const due = await prisma.payout.findMany({
    where: {
      status: "PENDING",
      availableAt: { lte: now },
    },
    select: { id: true, sellerId: true, netCents: true, currency: true },
    orderBy: { availableAt: "asc" },
    take: limit,
  });
  if (due.length === 0) return { finalized: 0 };

  const result = await prisma.payout.updateMany({
    where: {
      id: { in: due.map((p) => p.id) },
      status: "PENDING",
      availableAt: { lte: now },
    },
    data: { status: "AVAILABLE" },
  });

  if (result.count === 0) return { finalized: 0 };

  // 通知（按 seller 聚合一次性发，避免一个卖家收到 N 条；fire-and-forget）。
  const grouped = new Map<
    string,
    { count: number; netCents: number; currency: string }
  >();
  for (const p of due) {
    const cur = grouped.get(p.sellerId) ?? {
      count: 0,
      netCents: 0,
      currency: p.currency,
    };
    cur.count += 1;
    cur.netCents += p.netCents;
    grouped.set(p.sellerId, cur);
  }
  await Promise.all(
    Array.from(grouped.entries()).map(([sellerId, agg]) =>
      notifyPayoutAvailable({
        sellerId,
        count: agg.count,
        netCents: agg.netCents,
        currency: agg.currency,
      }).catch(() => undefined),
    ),
  );

  return { finalized: result.count };
}

// ──────────────────────────── 6. 卖家申请提现 ────────────────────────────

export interface RequestPayoutResult {
  requested: number;
  pendingNetCents: number;
}

/**
 * 卖家点「申请提现」：把所有 AVAILABLE 且 requestedAt IS NULL 的 Payout 标记 requestedAt=now。
 *
 * 必须先绑定收款账号；否则 ValidationError。
 * 没有可申请的 AVAILABLE 行 → ConflictError。
 */
export async function requestPayout(
  sellerId: string,
): Promise<RequestPayoutResult> {
  const account = await getPayoutAccount(sellerId);
  if (!account.hasAccount) {
    throw new ValidationError("请先绑定收款账号再申请提现");
  }
  const targets = await prisma.payout.findMany({
    where: {
      sellerId,
      status: "AVAILABLE",
      requestedAt: null,
    },
    select: { id: true, netCents: true },
  });
  if (targets.length === 0) {
    throw new ConflictError("当前没有可申请提现的结算单");
  }
  const now = new Date();
  const result = await prisma.payout.updateMany({
    where: {
      id: { in: targets.map((t) => t.id) },
      status: "AVAILABLE",
      requestedAt: null,
    },
    data: { requestedAt: now },
  });
  const pendingNetCents = targets.reduce((s, t) => s + t.netCents, 0);
  return { requested: result.count, pendingNetCents };
}

// ──────────────────────────── 7. Admin 标记打款 ────────────────────────────

export interface MarkPayoutPaidArgs {
  payoutId: string;
  adminId: string;
  note?: string;
}

export interface MarkPayoutPaidResult {
  payoutId: string;
  netCents: number;
  currency: string;
  sellerId: string;
}

/**
 * Admin 在 /admin/payouts 点「标记已打款」。流程：
 *   1. 读 Payout（必须 AVAILABLE）+ 卖家收款账号；账号未绑定 → 拒绝（避免打错）。
 *   2. tx 内 updateMany WHERE status='AVAILABLE' set status='PAID' + 时间戳 + 快照账号 + admin id。
 *      updateMany 命中 0 → 已被另一 admin 处理 → ConflictError，调用方刷新页面。
 *   3. 通知卖家 PAYOUT_PAID + AuditLog（调用方在 API 层做，这里只暴露最小返回数据）。
 *
 * 注意：本方法不写 AuditLog（避免循环依赖 audit + 业务层），由 API 路由统一调 createAuditLog。
 */
export async function markPayoutPaid(
  args: MarkPayoutPaidArgs,
): Promise<MarkPayoutPaidResult> {
  const payout = await prisma.payout.findUnique({
    where: { id: args.payoutId },
    select: {
      id: true,
      status: true,
      sellerId: true,
      netCents: true,
      currency: true,
      seller: {
        select: {
          payoutMethod: true,
          payoutAccount: true,
          payoutName: true,
        },
      },
    },
  });
  if (!payout) throw new NotFoundError("结算单");
  if (payout.status !== "AVAILABLE") {
    throw new ValidationError(
      `结算单当前状态为 ${payout.status}，仅 AVAILABLE 状态可标记打款`,
    );
  }
  if (
    !payout.seller.payoutMethod ||
    !payout.seller.payoutAccount ||
    !payout.seller.payoutName
  ) {
    throw new ValidationError(
      "卖家尚未绑定收款账号，无法标记打款（请联系卖家在 /me/earnings 完善信息）",
    );
  }

  const now = new Date();
  const updated = await prisma.payout.updateMany({
    where: { id: payout.id, status: "AVAILABLE" },
    data: {
      status: "PAID",
      paidAt: now,
      paidById: args.adminId,
      paidMethod: payout.seller.payoutMethod,
      paidAccount: payout.seller.payoutAccount,
      paidName: payout.seller.payoutName,
      paidNote: args.note ?? null,
    },
  });
  if (updated.count === 0) {
    throw new ConflictError("结算单状态已变更，请刷新页面");
  }

  await notifyPayoutPaid({
    sellerId: payout.sellerId,
    netCents: payout.netCents,
    currency: payout.currency,
  }).catch(() => undefined);

  return {
    payoutId: payout.id,
    netCents: payout.netCents,
    currency: payout.currency,
    sellerId: payout.sellerId,
  };
}

// ──────────────────────────── 8. 单条详情（admin 退款关联场景） ────────────────────────────

export async function getPayoutForAdmin(id: string): Promise<AdminPayoutRow | null> {
  const p = await prisma.payout.findUnique({
    where: { id },
    include: ADMIN_PAYOUT_INCLUDE,
  });
  if (!p) return null;
  return shapeAdmin(p);
}

/**
 * 卖家撤回提现申请（仅在 admin 还没标记 PAID 时可撤回）。
 * 返回撤回的行数；0 → 没有可撤回的（或并发被 admin 抢先）。
 */
export async function cancelPayoutRequest(sellerId: string): Promise<{
  canceled: number;
}> {
  const result = await prisma.payout.updateMany({
    where: {
      sellerId,
      status: "AVAILABLE",
      requestedAt: { not: null },
    },
    data: { requestedAt: null },
  });
  return { canceled: result.count };
}

// 校验调用方未传非法的 sellerId（用于 API 鉴权层）
export function assertOwnsPayout(payoutSellerId: string, viewerId: string) {
  if (payoutSellerId !== viewerId) {
    throw new ForbiddenError("仅卖家本人可操作该结算单");
  }
}
