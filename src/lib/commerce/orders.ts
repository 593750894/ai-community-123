import "server-only";

import { randomBytes } from "node:crypto";

import { Prisma, prisma } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import {
  notifyOrderPaid,
  notifyWorkflowSold,
} from "@/lib/notifications/emit";
import { getProviderForMethod, providerSlug } from "@/lib/payments/registry";
import type { PaymentMethod } from "@/generated/prisma/client";

import type { CreateOrderInput } from "./schemas";
import { formatPrice } from "./schemas";
import { calcAvailableAt, calcNetCents, calcPlatformFeeCents } from "./config";

/**
 * Stage 10.2：订单中枢。
 *
 * 责任划分：
 * - createOrder：基于 plan/workflowItem 快照价 → 建 PENDING 单 → 调 provider.createCharge 拿支付链接。
 * - refreshOrderStatus：保留为 no-op；过期判定改在 UI / 查询层做（避免与 webhook PAID 竞态）。
 * - markOrderPaid：webhook / 模拟支付落 PAID + 副作用（Subscription / Payout / 通知 / salesCount）。
 *   通过 updateMany WHERE status=PENDING 保证回调重放幂等。
 *
 * 订单超时 30min；Payout 确认期 + 平台抽成都从 config.ts 读，可通过 PAYOUT_HOLD_DAYS / PLATFORM_FEE_BPS env 覆盖。
 */

const ORDER_TTL_MS = 30 * 60 * 1000;

export const ORDER_TTL_MINUTES = ORDER_TTL_MS / 60_000;

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

/**
 * Stage 16.2：复用既有 clientNonce 订单。仅当 PENDING + 有 paymentUrl 时视为可复用，
 * 否则视为同一 nonce 之前的某次创建已被取消 / 失败 / 不完整 → 让客户端拿新 intent 再下单。
 */
async function findOrderByNonce(
  buyerId: string,
  clientNonce: string,
): Promise<CreateOrderResult | null> {
  const existing = await prisma.order.findUnique({
    where: {
      userId_clientNonce: { userId: buyerId, clientNonce },
    },
    select: {
      orderNo: true,
      status: true,
      amountCents: true,
      currency: true,
      expiresAt: true,
      paymentMethod: true,
      metadata: true,
    },
  });
  if (!existing) return null;
  if (existing.status !== "PENDING") {
    throw new ConflictError("该请求已被处理，请刷新页面后重试");
  }
  const meta =
    existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};
  const paymentUrl =
    typeof meta.paymentUrl === "string" ? meta.paymentUrl : null;
  if (!paymentUrl || !existing.paymentMethod || !existing.expiresAt) {
    throw new ConflictError("该请求已被处理，但订单数据缺失，请刷新页面后重试");
  }
  return {
    orderNo: existing.orderNo,
    paymentUrl,
    amountCents: existing.amountCents,
    currency: existing.currency,
    expiresAt: existing.expiresAt,
    paymentMethod: existing.paymentMethod,
  };
}

/**
 * 订单号：YYYYMMDDHHMMSS（UTC）+ 8 位随机 hex；总长度 22。
 * 与 cuid 长度区间不重叠，方便正则区分。
 */
export function generateOrderNo(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts =
    String(now.getUTCFullYear()) +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds());
  const rand = randomBytes(4).toString("hex");
  return `${ts}${rand}`;
}

export const ORDER_NO_RE = /^\d{14}[a-f0-9]{8}$/;

export interface CreateOrderResult {
  orderNo: string;
  paymentUrl: string;
  amountCents: number;
  currency: string;
  expiresAt: Date;
  paymentMethod: PaymentMethod;
}

export async function createOrder(
  buyerId: string,
  input: CreateOrderInput,
  baseUrl: string,
): Promise<CreateOrderResult> {
  // ── 0. Stage 16.2：clientNonce 命中既有 PENDING 单 → 直接返回 ─────
  // 同 (userId, clientNonce) 复合唯一，所以同一用户重发请求会落到这里。
  // 命中非 PENDING（已 CANCELED / FAILED）则视为已被处理，让客户端刷新页面拿新 intent。
  if (input.clientNonce) {
    const replay = await findOrderByNonce(buyerId, input.clientNonce);
    if (replay) return replay;
  }

  // ── 1. 快照价格 / 校验业务规则 ─────────────────────────────
  let amountCents: number;
  let currency: string;
  let subject: string;
  let planId: string | null = null;
  let workflowItemId: string | null = null;
  let sellerIdForMetadata: string | null = null;

  if (input.type === "MEMBERSHIP") {
    const plan = await prisma.membershipPlan.findUnique({
      where: { slug: input.planSlug },
      select: {
        id: true,
        name: true,
        priceCents: true,
        currency: true,
        isActive: true,
      },
    });
    if (!plan) throw new NotFoundError("会员计划");
    if (!plan.isActive) throw new ValidationError("该会员计划已停售");
    if (plan.priceCents <= 0)
      throw new ValidationError("免费计划无需下单");
    amountCents = plan.priceCents;
    currency = plan.currency;
    subject = plan.name;
    planId = plan.id;
  } else {
    const item = await prisma.workflowItem.findUnique({
      where: { id: input.workflowItemId },
      select: {
        id: true,
        title: true,
        priceCents: true,
        currency: true,
        status: true,
        sellerId: true,
      },
    });
    if (!item) throw new NotFoundError("商品");
    if (item.status !== "PUBLISHED")
      throw new ValidationError("商品已下架或售罄");
    if (item.priceCents <= 0)
      throw new ValidationError("免费商品无需下单");
    if (item.sellerId === buyerId)
      throw new ValidationError("不能购买自己的商品");
    amountCents = item.priceCents;
    currency = item.currency;
    subject = item.title;
    workflowItemId = item.id;
    sellerIdForMetadata = item.sellerId;
  }

  const provider = getProviderForMethod(input.paymentMethod);
  if (!provider) {
    // 生产环境 mock 未开启 + 真实渠道还没接（Stage 10.3 上线后才有）。
    throw new ValidationError("当前支付渠道暂未开通，请稍后再试");
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ORDER_TTL_MS);

  // ── 2. 落 PENDING 单 ─────────────────────────────────────────────
  // 两类 P2002：
  //   - target 含 client_nonce：并发请求抢先建了；重读返回胜出方（不算错）。
  //   - target 含 order_no：极小概率 orderNo 撞车，换一个重试。
  let orderNo = generateOrderNo(now);
  let orderId: string | null = null;
  let raceWinner: CreateOrderResult | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const created = await prisma.order.create({
        data: {
          userId: buyerId,
          orderNo,
          type: input.type,
          status: "PENDING",
          amountCents,
          currency,
          planId,
          workflowItemId,
          paymentMethod: input.paymentMethod,
          expiresAt,
          clientNonce: input.clientNonce ?? null,
          metadata: sellerIdForMetadata
            ? ({ sellerId: sellerIdForMetadata } as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
        select: { id: true, orderNo: true },
      });
      orderId = created.id;
      orderNo = created.orderNo;
      break;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const target = err.meta?.target;
        const targetCols = Array.isArray(target)
          ? (target as string[])
          : typeof target === "string"
            ? [target]
            : [];
        if (
          input.clientNonce &&
          targetCols.some((c) => c.includes("client_nonce"))
        ) {
          // 并发请求胜出；重读返回它（含 paymentUrl）。
          const winner = await findOrderByNonce(buyerId, input.clientNonce);
          if (winner) {
            raceWinner = winner;
            break;
          }
          // 极端情况下 P2002 后再 findFirst 又拿不到（事务隔离 / 视图不一致），
          // 直接抛 Conflict 让客户端重试。
          throw new ConflictError("订单创建竞态失败，请重试");
        }
        // orderNo 撞车（极少）：换一个重试
        orderNo = generateOrderNo();
        continue;
      }
      throw err;
    }
  }
  if (raceWinner) return raceWinner;
  if (!orderId) throw new ConflictError("生成订单失败，请重试");

  // ── 3. 调 provider 拿付款链接 ───────────────────────────────
  // createCharge 失败 → 把已建的 PENDING 单标 FAILED，避免遗留无法支付的僵尸订单；
  // 第三方网络异常会被向上抛出，由 API 路由翻译成 5xx。
  //
  // returnUrl：用户付完跳回；可走 baseUrl（request host），对 host 伪造容忍。
  // notifyUrl：PSP → 我们；必须用 PUBLIC_APP_URL 锁定（不接受 Host 伪造）。
  // 当 PUBLIC_APP_URL 未配置时 fallback 到 baseUrl，仅适用于 dev tunnel 场景；
  // 生产部署 / 沙箱联调强烈建议显式配置。
  const publicBase = stripTrailingSlash(
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.PUBLIC_APP_URL ?? "",
  );
  const notifyBase = publicBase || baseUrl;
  let charge;
  try {
    charge = await provider.createCharge({
      orderNo,
      amountCents,
      currency,
      subject,
      returnUrl: `${baseUrl}/checkout/${orderNo}`,
      notifyUrl: `${notifyBase}/api/payments/webhook/${providerSlug(provider)}`,
      expiresAt,
    });
  } catch (err) {
    await prisma.order
      .updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { status: "FAILED" },
      })
      .catch(() => {});
    throw err;
  }

  const metadata: Record<string, unknown> = {
    paymentUrl: charge.paymentUrl,
    providerId: String(provider.id),
  };
  if (sellerIdForMetadata) metadata.sellerId = sellerIdForMetadata;
  // JSAPI 6 字段签名 payload 落 metadata（仅本人 GET /api/orders/{orderNo}/jsapi-invoke 可读）。
  // 不能进 URL 或 GET /api/orders 主响应 — paySign 在 referer / 访问日志里会泄漏。
  if (charge.jsapiInvoke) {
    metadata.jsapiInvoke = charge.jsapiInvoke;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      transactionId: charge.transactionId,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  return {
    orderNo,
    paymentUrl: charge.paymentUrl,
    amountCents,
    currency,
    expiresAt,
    paymentMethod: input.paymentMethod,
  };
}

/**
 * Stage 10.2：刻意保留为 no-op。
 *
 * 之前的实现在 GET 时把过期 PENDING 单自动 CANCELED；与同时到达的 webhook PAID
 * 形成 last-write-wins 竞态 — refresh 赢则用户付了钱但订单永远停在 CANCELED。
 * 真实 PSP（微信 / 支付宝）不会在过期后还回调，但开发期 mock 会，10.3 后接入的渠道
 * 也可能有迟到回调。为消除这条丢钱路径，过期判定改在 UI / 查询展示层做（不写库）。
 *
 * 后续清理 PENDING + expiresAt 过期的订单交给 admin / cron 处理，那里可以
 * 在批处理外搭配 `paid_at IS NULL AND transaction_id IS NULL` 做防御 — 见 expireStalePendingOrders。
 */
export async function refreshOrderStatus(orderNo: string): Promise<void> {
  void orderNo;
}

/**
 * Stage 10.3：批量将过期 PENDING 单标记 CANCELED。
 *
 * 调用方：admin 手动触发 / cron。前置条件（防丢钱）：
 *   - status = PENDING
 *   - expiresAt < now - graceMs（默认 5min 防御冗余，避免临界回调被截胡）
 *   - paidAt IS NULL → webhook 还没到（status=PENDING 已隐含，做双重防御）
 *
 * 注意：不能用 `transactionId IS NULL` 做防御 — createOrder 在初始 update 阶段就会写
 * provider 返回的 transactionId（mock_xxx / prepay_id / orderNo 占位），实际 PENDING 单
 * 几乎都有非空 transactionId；用它过滤 → 此 cron 退化为 no-op。
 *
 * 竞态保护：findMany → updateMany 二阶段中间若 webhook 抢先把行落 PAID，
 * updateMany WHERE id IN AND status='PENDING' AND paidAt IS NULL 不会命中 → 安全。
 *
 * 返回受影响行数；调用方可入库 AuditLog（Stage 10.4 做）。
 */
export async function expireStalePendingOrders(args?: {
  /** 额外宽限时间（毫秒），默认 5 分钟。 */
  graceMs?: number;
  /** 单次最大扫描行数，默认 500，避免大事务。 */
  limit?: number;
}): Promise<{ canceled: number }> {
  const graceMs = args?.graceMs ?? 5 * 60 * 1000;
  const limit = args?.limit ?? 500;
  const cutoff = new Date(Date.now() - graceMs);
  const stale = await prisma.order.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: cutoff },
      paidAt: null,
    },
    select: { id: true },
    orderBy: { expiresAt: "asc" },
    take: limit,
  });
  if (stale.length === 0) return { canceled: 0 };
  const result = await prisma.order.updateMany({
    where: {
      id: { in: stale.map((o) => o.id) },
      status: "PENDING",
      paidAt: null,
    },
    data: { status: "CANCELED" },
  });
  return { canceled: result.count };
}

export interface MarkPaidInput {
  orderNo: string;
  transactionId: string;
  amountCents: number;
  paidAt: Date;
  callbackPayload: unknown;
}

export interface MarkPaidResult {
  alreadyPaid: boolean;
  type: "MEMBERSHIP" | "WORKFLOW_PURCHASE" | "OTHER";
}

/**
 * 标记订单已付款 — webhook + 模拟支付的唯一入口。
 *
 * 幂等保证：updateMany WHERE status=PENDING；count=0 → 已被另一回调处理过，安全返回。
 * 金额对账：amountCents 必须等于订单快照；不一致 → ValidationError，不写库。
 *
 * 副作用：
 * - WORKFLOW_PURCHASE：salesCount +1 + Payout PENDING（available_at = +7d）+ 通知卖家。
 * - MEMBERSHIP：upsert Subscription（同 plan 已有 → 延期）+ 通知买家。
 */
export async function markOrderPaid(
  input: MarkPaidInput,
): Promise<MarkPaidResult> {
  const order = await prisma.order.findUnique({
    where: { orderNo: input.orderNo },
    select: {
      id: true,
      userId: true,
      status: true,
      type: true,
      amountCents: true,
      currency: true,
      planId: true,
      workflowItemId: true,
    },
  });
  if (!order) throw new NotFoundError("订单");
  if (order.status === "PAID") {
    return { alreadyPaid: true, type: orderTypeBranch(order.type) };
  }
  if (order.status !== "PENDING") {
    throw new ValidationError(
      `订单当前状态为 ${order.status}，不可标记付款`,
    );
  }
  if (order.amountCents !== input.amountCents) {
    throw new ValidationError("订单金额与回调金额不一致");
  }

  const workflow = order.workflowItemId
    ? await prisma.workflowItem.findUnique({
        where: { id: order.workflowItemId },
        select: { id: true, sellerId: true, title: true },
      })
    : null;

  const txResult = await prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        status: "PAID",
        transactionId: input.transactionId,
        paidAt: input.paidAt,
        callbackPayload: input.callbackPayload as Prisma.InputJsonValue,
      },
    });
    if (result.count === 0) {
      return { transitioned: false as const };
    }

    if (order.type === "WORKFLOW_PURCHASE" && workflow) {
      await tx.workflowItem.update({
        where: { id: workflow.id },
        data: { salesCount: { increment: 1 } },
      });
      const platformFee = calcPlatformFeeCents(order.amountCents);
      const net = calcNetCents(order.amountCents);
      const availableAt = calcAvailableAt(input.paidAt);
      await tx.payout.create({
        data: {
          orderId: order.id,
          sellerId: workflow.sellerId,
          grossCents: order.amountCents,
          platformFeeCents: platformFee,
          netCents: net,
          currency: order.currency,
          status: "PENDING",
          availableAt,
        },
      });
    }

    if (order.type === "MEMBERSHIP" && order.planId) {
      const plan = await tx.membershipPlan.findUnique({
        where: { id: order.planId },
        select: { id: true, cycle: true },
      });
      if (plan) {
        const start = input.paidAt;
        // 部分唯一索引 subscriptions_user_plan_active_unique 保证
        // 同一 (userId, planId) 最多一条 ACTIVE 行；并发场景由 P2002 兜底。
        await upsertActiveSubscription(tx, {
          userId: order.userId,
          planId: plan.id,
          cycle: plan.cycle,
          start,
        });
      }
    }

    return { transitioned: true as const };
  });

  if (!txResult.transitioned) {
    return { alreadyPaid: true, type: orderTypeBranch(order.type) };
  }

  // 通知不入 tx，失败吞掉
  await notifyOrderPaid({
    buyerId: order.userId,
    orderNo: input.orderNo,
    amountCents: order.amountCents,
    currency: order.currency,
    amountDisplay: formatPrice(order.amountCents, order.currency),
  });
  if (workflow) {
    await notifyWorkflowSold({
      sellerId: workflow.sellerId,
      itemTitle: workflow.title,
      orderNo: input.orderNo,
      amountDisplay: formatPrice(order.amountCents, order.currency),
    });
  }

  return { alreadyPaid: false, type: orderTypeBranch(order.type) };
}

export interface OrderForViewer {
  id: string;
  orderNo: string;
  userId: string;
  type: string;
  status: string;
  amountCents: number;
  currency: string;
  paymentMethod: PaymentMethod | null;
  paymentUrl: string | null;
  transactionId: string | null;
  expiresAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  plan: {
    id: string;
    slug: string;
    name: string;
    cycle: string;
  } | null;
  workflowItem: {
    id: string;
    title: string;
    coverUrl: string | null;
    downloadUrl: string | null;
    seller: { id: string; username: string; name: string };
  } | null;
}

/** 按订单号读取订单详情；非本人访问抛 ForbiddenError。 */
export async function getOrderByNo(
  orderNo: string,
  viewerId: string,
): Promise<OrderForViewer | null> {
  const order = await prisma.order.findUnique({
    where: { orderNo },
    select: {
      id: true,
      orderNo: true,
      userId: true,
      type: true,
      status: true,
      amountCents: true,
      currency: true,
      paymentMethod: true,
      transactionId: true,
      expiresAt: true,
      paidAt: true,
      createdAt: true,
      metadata: true,
      plan: {
        select: { id: true, slug: true, name: true, cycle: true },
      },
      workflowItem: {
        select: {
          id: true,
          title: true,
          coverUrl: true,
          downloadUrl: true,
          seller: { select: { id: true, username: true, name: true } },
        },
      },
    },
  });
  if (!order) return null;
  if (order.userId !== viewerId) {
    throw new ForbiddenError("订单仅本人可见");
  }
  const { metadata, ...rest } = order;
  const paymentUrl =
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    typeof (metadata as Record<string, unknown>).paymentUrl === "string"
      ? ((metadata as Record<string, unknown>).paymentUrl as string)
      : null;
  return { ...rest, paymentUrl } as OrderForViewer;
}

function orderTypeBranch(
  t: string,
): "MEMBERSHIP" | "WORKFLOW_PURCHASE" | "OTHER" {
  return t === "MEMBERSHIP" || t === "WORKFLOW_PURCHASE" ? t : "OTHER";
}

/**
 * 创建或延期 ACTIVE 订阅。并发安全：依赖 subscriptions_user_plan_active_unique
 * 部分唯一索引（仅 status='ACTIVE'），create 时若被并发 PAID 抢先 → P2002 →
 * fall through 到第二次 update 延期，最终一致。
 */
async function upsertActiveSubscription(
  tx: Prisma.TransactionClient,
  args: { userId: string; planId: string; cycle: string; start: Date },
): Promise<void> {
  const existing = await tx.subscription.findFirst({
    where: {
      userId: args.userId,
      planId: args.planId,
      status: "ACTIVE",
    },
    select: { id: true, currentPeriodEnd: true },
  });
  if (existing) {
    const base =
      existing.currentPeriodEnd > args.start
        ? existing.currentPeriodEnd
        : args.start;
    await tx.subscription.update({
      where: { id: existing.id },
      data: { currentPeriodEnd: nextPeriodEnd(base, args.cycle) },
    });
    return;
  }
  try {
    await tx.subscription.create({
      data: {
        userId: args.userId,
        planId: args.planId,
        status: "ACTIVE",
        startedAt: args.start,
        currentPeriodEnd: nextPeriodEnd(args.start, args.cycle),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // 并发抢先：再查 + 延期一次
      const concurrent = await tx.subscription.findFirst({
        where: {
          userId: args.userId,
          planId: args.planId,
          status: "ACTIVE",
        },
        select: { id: true, currentPeriodEnd: true },
      });
      if (concurrent) {
        const base =
          concurrent.currentPeriodEnd > args.start
            ? concurrent.currentPeriodEnd
            : args.start;
        await tx.subscription.update({
          where: { id: concurrent.id },
          data: { currentPeriodEnd: nextPeriodEnd(base, args.cycle) },
        });
      }
      return;
    }
    throw err;
  }
}

function nextPeriodEnd(from: Date, cycle: string): Date {
  // 用 UTC* setter 保持 tz 无关；非 UTC 服务器（如 UTC+8）走 setMonth/setFullYear
  // 会让周期边界落在错误的日期（例如 2-29 + 1 月 → 服务器 tz 决定到底是 3-29 还是 3-30）。
  const d = new Date(from);
  switch (cycle) {
    case "MONTHLY":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "QUARTERLY":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case "ANNUAL":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    case "LIFETIME":
      d.setUTCFullYear(d.getUTCFullYear() + 100);
      break;
    default:
      d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return d;
}
