import "server-only";

import { Prisma, prisma } from "@/lib/db";
import {
  AppError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { createAuditLog } from "@/lib/admin/audit";
import { emitNotification, notifyOrderRefunded } from "@/lib/notifications/emit";
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

    if (order.type === "WORKFLOW_PURCHASE" && order.workflowItemId) {
      if (fullyRefunded) {
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
      }

      // Stage 16.4：根据 Payout 状态决定怎么处理卖家侧的钱。
      // - PENDING / AVAILABLE → 钱还在平台手里，直接 CANCELED 即可（旧逻辑）。
      // - PAID → 钱已打给卖家，平台垫资退给买家 → 建 ClawbackRequest 让 ops 追回。
      const payout = await tx.payout.findUnique({
        where: { orderId: order.id },
        select: { id: true, status: true, sellerId: true, netCents: true },
      });
      if (payout) {
        if (payout.status === "PENDING" || payout.status === "AVAILABLE") {
          if (fullyRefunded) {
            await tx.payout.update({
              where: { id: payout.id },
              data: { status: "CANCELED" },
            });
          }
          // 部分退款 + payout 仍在冷藏 / 可用 → 暂不动 payout 金额；
          // 等 stage 16.5 引入 payout 净额逐次抵扣的实现后再回填。
        } else if (payout.status === "PAID") {
          // 净额按本次退款金额 / 订单总额比例计算（保留卖家最低 1 分获得感）。
          // 全额退款 → 全额追回净额；部分退款 → 按比例。
          const clawAmount = Math.min(
            payout.netCents,
            Math.max(
              1,
              Math.round((payout.netCents * refundAmount) / order.amountCents),
            ),
          );
          // refundId unique：同一 Refund 至多一条 Clawback；重入安全。
          await tx.clawbackRequest.create({
            data: {
              refundId,
              payoutId: payout.id,
              sellerId: payout.sellerId,
              orderId: order.id,
              orderNo: order.orderNo,
              amountCents: clawAmount,
              currency: order.currency,
              status: "PENDING",
            },
          });
        }
        // CANCELED Payout：旧退款已处理过 / 异常状态，跳过。
      }
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

// ────────────────────────── Stage 18.0 reconcile cron ──────────────────────────

/**
 * Stage 18.0：扫描 PENDING > olderThanMs 的 Refund 行，给所有 ADMIN 推 SYSTEM 通知
 * 让 ops 手动到 PSP 核对一次，并决定 mark FAILED 还是 SUCCESS。
 *
 * 为何不自动改状态：provider 接口当前没有 queryRefund(idempotencyKey)；如果盲 mark FAILED，
 * 实际已扣款的退款会被误判为「未发起」，导致 admin 再发起一次 → 双重退款。
 * 通知触达 + 人工裁定是 MVP 安全做法；下一版 provider 增加 queryRefund 后可改自动收敛。
 *
 * 同一 Refund 24h 内只推一次通知，防止 cron 每小时刷屏。
 */
export interface ReconcileStalePendingRefundsResult {
  scanned: number;
  notified: number;
}

const STALE_REFUND_NOTIFY_DEDUP_MS = 24 * 60 * 60 * 1000;

export async function reconcileStalePendingRefunds(args?: {
  olderThanMs?: number;
  limit?: number;
}): Promise<ReconcileStalePendingRefundsResult> {
  const olderThanMs = args?.olderThanMs ?? 60 * 60 * 1000; // 默认 1h
  const limit = Math.max(1, Math.min(args?.limit ?? 200, 1000));
  const cutoff = new Date(Date.now() - olderThanMs);

  const stale = await prisma.refund.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      order: {
        select: { orderNo: true, amountCents: true, currency: true },
      },
    },
  });
  if (stale.length === 0) return { scanned: 0, notified: 0 };

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  if (admins.length === 0) return { scanned: stale.length, notified: 0 };

  const dedupSince = new Date(Date.now() - STALE_REFUND_NOTIFY_DEDUP_MS);
  let notified = 0;

  for (const r of stale) {
    const ageMinutes = Math.round(
      (Date.now() - r.createdAt.getTime()) / 60000,
    );
    // 24h dedup：检测任意一个 admin 是否在窗口内已收到过同 Refund 的通知。
    // 假设：所有 admin 同一 cron 同步推送；一个有就视为「这轮已发」整体跳过。
    const existing = await prisma.notification.findFirst({
      where: {
        actorId: null,
        type: "SYSTEM",
        targetType: "Refund",
        targetId: r.id,
        createdAt: { gte: dedupSince },
      },
      select: { id: true },
    });
    if (existing) continue;

    const title = `退款卡在 PENDING ${ageMinutes} 分钟，请人工核对`;
    const body = `订单 ${r.order.orderNo} 退款 ${formatPrice(r.amountCents, r.order.currency)}（refund=${r.id.slice(0, 10)}…）。请到 PSP 后台确认本次退款最终状态，再到 admin/orders 手动标 SUCCESS/FAILED。`;
    const link = `/admin/orders/${r.order.orderNo}`;
    await Promise.all(
      admins.map((admin) =>
        emitNotification({
          recipientId: admin.id,
          actorId: null,
          type: "SYSTEM",
          title,
          body,
          link,
          targetType: "Refund",
          targetId: r.id,
        }),
      ),
    );
    notified += 1;
  }

  return { scanned: stale.length, notified };
}
