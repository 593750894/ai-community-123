import "server-only";

import { Prisma, prisma } from "@/lib/db";
import {
  AppError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { createAuditLog } from "@/lib/admin/audit";
import { notifyOrderRefunded } from "@/lib/notifications/emit";
import { getProviderForMethod } from "@/lib/payments/registry";

import { formatPrice } from "./schemas";

/**
 * Stage 10.4：订单退款。
 *
 * 流程：
 *   1. 读订单（必须 PAID）+ 汇总已成功退款金额；校验本次额度 ≤ 剩余可退。
 *   2. tx 内插入 Refund 行 PENDING（id 即 PSP idempotencyKey 来源）。
 *   3. 调 provider.refund(`R{refund.id}`)；不在 tx 内（PSP 调用慢，避免 Postgres 长事务）。
 *   4. 根据结果 finalize：
 *      - SUCCESS：tx 内 Refund.status=SUCCESS、Order.refundCents+=、若全额则 Order.status=REFUNDED
 *        + workflowItem.salesCount--（不下穿）+ Payout 若仍 PENDING/AVAILABLE 则 CANCELED；
 *      - FAILED：tx 内仅更新 Refund.status=FAILED，Order 不动；调用方收到 502/4xx。
 *   5. SUCCESS 后 fire-and-forget AuditLog + notifyOrderRefunded（失败吞）。
 *
 * 已知 MVP 限制：
 *   - 步骤 3 → 4 之间进程崩溃 → Refund.status 停在 PENDING，PSP 已扣款。
 *     调用方可通过 PSP query API 或人工对账修复；Stage 10.5 加 reconcile cron。
 *   - Payout PAID（已结算给卖家）的全额退款只标记 metadata，不发起 clawback。
 *   - 部分退款不调整 Payout 金额；累计退款金额仍写入 metadata 供 admin 复核。
 *
 * 并发：
 *   - 同一订单两个 admin 同时退款 → 都通过 amount 校验但分别建 Refund 行。
 *     仅靠 rate-limit + 业务流程约束（admin 不会同时操作同一单）；MVP 不引入 SELECT FOR UPDATE。
 */

export interface RefundOrderInput {
  orderNo: string;
  adminId: string;
  /** 显式金额（分）；省略 = 全额退剩余可退。 */
  amountCents?: number;
  /** 退款理由；进 PSP + AuditLog metadata。 */
  reason?: string;
}

export interface RefundOrderResult {
  refundId: string;
  /** 本次退款金额（分）。 */
  amountCents: number;
  /** 操作后订单累计已退（分）。 */
  refundCentsTotal: number;
  /** 是否触发 Order.status=REFUNDED。 */
  fullyRefunded: boolean;
}

/**
 * 发起一次退款。失败抛 AppError；成功返回 { refundId, amountCents, fullyRefunded }。
 */
export async function refundOrder(
  input: RefundOrderInput,
): Promise<RefundOrderResult> {
  // ── 1. 读订单 + 已退汇总 ─────────────────────────────────────────
  const order = await prisma.order.findUnique({
    where: { orderNo: input.orderNo },
    select: {
      id: true,
      orderNo: true,
      userId: true,
      status: true,
      type: true,
      amountCents: true,
      currency: true,
      paymentMethod: true,
      transactionId: true,
      workflowItemId: true,
      refundCents: true,
    },
  });
  if (!order) throw new NotFoundError("订单");
  if (order.status !== "PAID") {
    throw new ValidationError(
      `订单当前状态为 ${order.status}，仅 PAID 订单可发起退款`,
    );
  }
  if (!order.paymentMethod) {
    throw new ValidationError("订单缺少支付渠道信息，无法退款");
  }

  // 用 Refund 表 SUCCESS 行之和作为 source of truth；Order.refundCents 作为快速访问字段，
  // 二者理论上一致，但若历史数据漂移（手工 patch 等）以 Refund 表为准。
  const successRefunds = await prisma.refund.findMany({
    where: { orderId: order.id, status: "SUCCESS" },
    select: { amountCents: true },
  });
  const alreadyRefunded = successRefunds.reduce(
    (sum, r) => sum + r.amountCents,
    0,
  );
  const remaining = order.amountCents - alreadyRefunded;
  if (remaining <= 0) {
    throw new ValidationError("订单已全额退款，无剩余可退金额");
  }
  const refundAmount = input.amountCents ?? remaining;
  if (refundAmount <= 0) {
    throw new ValidationError("退款金额必须大于 0");
  }
  if (refundAmount > remaining) {
    throw new ValidationError(
      `退款金额（${formatPrice(refundAmount, order.currency)}）超出可退余额（${formatPrice(remaining, order.currency)}）`,
    );
  }

  const provider = getProviderForMethod(order.paymentMethod);
  if (!provider) {
    throw new ValidationError(
      `订单支付渠道 ${order.paymentMethod} 当前未启用，无法退款`,
    );
  }

  // ── 2. 插入 PENDING Refund 行 ─────────────────────────────────────
  const refund = await prisma.refund.create({
    data: {
      orderId: order.id,
      amountCents: refundAmount,
      reason: input.reason ?? null,
      status: "PENDING",
      createdById: input.adminId,
    },
    select: { id: true },
  });
  const idempotencyKey = `R${refund.id}`;

  // ── 3. 调 PSP（tx 外，避免长事务） ────────────────────────────────
  let providerOk = false;
  let providerRaw: unknown = null;
  let providerError: string | null = null;
  try {
    const res = await provider.refund({
      orderNo: order.orderNo,
      transactionId: order.transactionId,
      amountCents: refundAmount,
      originalAmountCents: order.amountCents,
      idempotencyKey,
      reason: input.reason,
    });
    providerOk = res.ok;
    providerRaw = res.raw ?? null;
    if (!providerOk) {
      providerError = res.message ?? "PSP 拒绝退款";
    }
  } catch (err) {
    providerOk = false;
    providerError = err instanceof Error ? err.message : String(err);
    providerRaw = null;
  }

  // ── 4. tx 内 finalize ────────────────────────────────────────────
  const fullyRefunded =
    providerOk && alreadyRefunded + refundAmount >= order.amountCents;
  const newTotal = providerOk
    ? alreadyRefunded + refundAmount
    : alreadyRefunded;

  await prisma.$transaction(async (tx) => {
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: providerOk ? "SUCCESS" : "FAILED",
        providerResponse:
          providerRaw == null
            ? Prisma.JsonNull
            : (providerRaw as Prisma.InputJsonValue),
        providerError,
        finishedAt: new Date(),
      },
    });
    if (!providerOk) return;

    await tx.order.update({
      where: { id: order.id },
      data: {
        refundCents: newTotal,
        refundReason: input.reason ?? null,
        refundedAt: new Date(),
        refundedById: input.adminId,
        ...(fullyRefunded ? { status: "REFUNDED" as const } : {}),
      },
    });

    if (fullyRefunded && order.type === "WORKFLOW_PURCHASE" && order.workflowItemId) {
      // salesCount 不下穿 0：先读再 max。decrement 在 Prisma 没有 GREATEST 包装。
      const wf = await tx.workflowItem.findUnique({
        where: { id: order.workflowItemId },
        select: { salesCount: true },
      });
      if (wf && wf.salesCount > 0) {
        await tx.workflowItem.update({
          where: { id: order.workflowItemId },
          data: { salesCount: { decrement: 1 } },
        });
      }
      await tx.payout.updateMany({
        where: {
          orderId: order.id,
          status: { in: ["PENDING", "AVAILABLE"] },
        },
        data: { status: "CANCELED" },
      });
    }
  });

  if (!providerOk) {
    throw new AppError(
      providerError ?? "退款失败",
      "REFUND_FAILED",
      502,
      providerRaw ?? undefined,
    );
  }

  // ── 5. AuditLog + 通知（fire-and-forget） ─────────────────────────
  await createAuditLog({
    adminId: input.adminId,
    action: fullyRefunded ? "ORDER_REFUND_FULL" : "ORDER_REFUND_PARTIAL",
    targetType: "Order",
    targetId: order.orderNo,
    metadata: {
      refundId: refund.id,
      orderNo: order.orderNo,
      buyerId: order.userId,
      paymentMethod: order.paymentMethod,
      currency: order.currency,
      orderAmountCents: order.amountCents,
      refundCents: refundAmount,
      refundCentsTotalAfter: newTotal,
      reason: input.reason ?? null,
      orderType: order.type,
    },
  });

  await notifyOrderRefunded({
    buyerId: order.userId,
    orderNo: order.orderNo,
    refundCents: refundAmount,
    currency: order.currency,
    refundDisplay: formatPrice(refundAmount, order.currency),
    fullyRefunded,
  });

  return {
    refundId: refund.id,
    amountCents: refundAmount,
    refundCentsTotal: newTotal,
    fullyRefunded,
  };
}
