"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import { IS_MOCK_ENABLED } from "@/lib/payments/mock";

import {
  getOrderByNo,
  markOrderPaid,
} from "./orders";

/**
 * Stage 10.2 模拟支付：仅 Mock provider 链路使用。
 * 点击 checkout 页"我已完成支付（模拟）"按钮触发；
 * 内部直接走 markOrderPaid（与真实 webhook 同一入口，保证 PAID 副作用一致）。
 *
 * 真实微信 / 支付宝接通后，UI 上的这个按钮会被 provider-specific 跳转替代。
 *
 * Gate：仅在 IS_MOCK_ENABLED=true 时生效（dev 自动 / 生产需显式 PAYMENT_MOCK_ENABLED=true）。
 * 否则静默 no-op，避免攻击者在 mock 未启用的部署上利用 simulate 路径让订单 PAID。
 */
export async function simulateMockPaymentAction(
  formData: FormData,
): Promise<void> {
  if (!IS_MOCK_ENABLED) return;
  const orderNo = String(formData.get("orderNo") || "").trim();
  if (!orderNo) return;
  const user = await requireUser(`/checkout/${orderNo}`);
  let order;
  try {
    order = await getOrderByNo(orderNo, user.id);
  } catch (err) {
    if (err instanceof AppError) return;
    throw err;
  }
  if (!order) return;
  if (order.status !== "PENDING") {
    // 已 PAID / CANCELED — 由页面重新渲染呈现最新态
    revalidatePath(`/checkout/${orderNo}`);
    return;
  }
  try {
    await markOrderPaid({
      orderNo,
      transactionId: order.transactionId ?? `mock_${orderNo}`,
      amountCents: order.amountCents,
      paidAt: new Date(),
      callbackPayload: { simulated: true, source: "checkout-ui" },
    });
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    // 业务异常静默；页面 refresh 后会显示真实状态
  }
  revalidatePath(`/checkout/${orderNo}`);
}
