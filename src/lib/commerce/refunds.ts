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
 * 流程（Stage 16.3 加锁后）：
 *   1. tx#1 (FOR UPDATE on order)：读订单 / 汇总 PENDING+SUCCESS 已占额 / 校验 / 插入 PENDING Refund。
 *      行级锁保证并发 admin 串行进入，且 PENDING refund 也计为「已占额」防止两单同时下发到 PSP。
 *   2. 调 provider.refund(`R{refund.id}`)；不在 tx 内（PSP 慢，避免 Postgres 长事务）。
 *   3. tx#2 (FOR UPDATE on order)：finalize：
 *      - SUCCESS：tx 内重算 SUCCESS 总额 → 写 Order.refundCents、若全额则 Order.status=REFUNDED
 *        + workflowItem.salesCount--（不下穿）+ Payout 若仍 PENDING/AVAILABLE 则 CANCELED；
 *      - FAILED：tx 内仅更新 Refund.status=FAILED，Order 不动；调用方收到 502/4xx。
 *   4. SUCCESS 后 fire-and-forget AuditLog + notifyOrderRefunded（失败吞）。
 *
 * 已知 MVP 限制：
 *   - 步骤 2 → 3 之间进程崩溃 → Refund.status 停在 PENDING，PSP 已扣款。
 *     该行的金额会长期占额并阻塞同单后续退款；ops 需要手动 mark FAILED。
 *     TODO：cron 扫 PENDING > 1h 的 refund，查 PSP 同步状态后落定。
 *   - Payout PAID（已结算给卖家）的全额退款只标记 metadata，不发起 clawback（stage 16.4 解决）。
 *   - 部分退款不调整 Payout 金额；累计退款金额仍写入 metadata 供 admin 复核。
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
  // ── tx#1：FOR UPDATE 读 / 校验 / 插 PENDING Refund ──────────────
  // 行级锁保证并发 admin 串行，PENDING 也计为「已占额」防止两笔同时下发 PSP。
  const tx1 = await prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE 拿订单行锁；orderNo 唯一索引，O(1) 命中。
    // 用 raw SQL 是因为 Prisma 没有原生 lockingClause API；返回不直接用。
    const lockRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "orders" WHERE order_no = ${input.orderNo} FOR UPDATE
    `;
    if (lockRows.length === 0) {
      throw new NotFoundError("订单");
    }

    const order = await tx.order.findUnique({
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

    // claimed = PENDING + SUCCESS 之和。包含 PENDING 是关键：
    // 同 order 上一笔退款正在调 PSP（PENDING 中）时，第二个 admin 不应再发起重叠退款。
    // FAILED 不算占额（PSP 已拒）；崩溃残留的 PENDING 仍占额——ops 需 mark FAILED 释放。
    const claimedAgg = await tx.refund.aggregate({
      where: {
        orderId: order.id,
        status: { in: ["PENDING", "SUCCESS"] },
      },
      _sum: { amountCents: true },
    });
    const claimed = claimedAgg._sum.amountCents ?? 0;
    const remaining = order.amountCents - claimed;
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

    const refund = await tx.refund.create({
      data: {
        orderId: order.id,
        amountCents: refundAmount,
        reason: input.reason ?? null,
        status: "PENDING",
        createdById: input.adminId,
      },
      select: { id: true },
    });

    return {
      order,
      refundId: refund.id,
      refundAmount,
    };
  });

  const { order, refundId, refundAmount } = tx1;
  const provider = getProviderForMethod(order.paymentMethod!);
  if (!provider) {
    // PSP 关闭 → 立即把 PENDING refund 标 FAILED 释放占额，避免阻塞后续手动处理。
    await prisma.refund
      .update({
        where: { id: refundId },
        data: {
          status: "FAILED",
          providerError: `payment method ${order.paymentMethod} disabled`,
          finishedAt: new Date(),
        },
      })
      .catch(() => {});
    throw new ValidationError(
      `订单支付渠道 ${order.paymentMethod} 当前未启用，无法退款`,
    );
  }
  const idempotencyKey = `R${refundId}`;

  // ── PSP 调用：tx 外，长耗时网络 IO 不能持锁 ──────────────────────
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

  // ── tx#2：FOR UPDATE 再上锁，重算 SUCCESS 总额，finalize ─────────
  let newTotal = 0;
  let fullyRefunded = false;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "orders" WHERE id = ${order.id} FOR UPDATE
    `;

    await tx.refund.update({
      where: { id: refundId },
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

    // tx 内重算 SUCCESS 总额，避免与其它并发 refund 的 FOR UPDATE 抢得后视图不一致。
    const successAgg = await tx.refund.aggregate({
      where: { orderId: order.id, status: "SUCCESS" },
      _sum: { amountCents: true },
    });
    newTotal = successAgg._sum.amountCents ?? 0;
    fullyRefunded = newTotal >= order.amountCents;

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

  // ── AuditLog + 通知（fire-and-forget） ───────────────────────────
  await createAuditLog({
    adminId: input.adminId,
    action: fullyRefunded ? "ORDER_REFUND_FULL" : "ORDER_REFUND_PARTIAL",
    targetType: "Order",
    targetId: order.orderNo,
    metadata: {
      refundId,
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
    refundId,
    amountCents: refundAmount,
    refundCentsTotal: newTotal,
    fullyRefunded,
  };
}
