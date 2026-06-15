import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

import type {
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
  QueryChargeResult,
  RefundInput,
  RefundResult,
  WebhookEvent,
} from "./types";

/**
 * Mock 支付供应商。Stage 10.2 用来跑通下单 → 支付 → webhook 全链路；
 * Stage 10.3 上线真实微信 / 支付宝后，mock 仍可用于 e2e 测试（需显式开启）。
 *
 * Gate（关键安全约束）：
 * - 必须显式 PAYMENT_MOCK_ENABLED=true 才启用，**无论 NODE_ENV**。
 *   旧实现的「非 production 自动启用」在 staging / preview 部署会被滥用：
 *   攻击者构造 HMAC 即可把任意 orderNo 置为 PAID。
 * - 启用时必须配 PAYMENT_MOCK_SECRET（env.ts 已 fail-fast 校验 ≥16 字符）；
 *   不再有 `seedland-dev-mock-secret` 回退。
 * - 关闭时（默认）mockProvider 仍被 export，但 registry 不注册，所有 webhook 验签直接 fail。
 *
 * Webhook 签名：HMAC-SHA256(secret, "orderNo=...&amountCents=...&transactionId=...&paidAt=...")
 * paidAt 必填且参与签名 → 同一订单的回调不可被改写时间戳重放。
 */

export const IS_MOCK_ENABLED = env.PAYMENT_MOCK_ENABLED;
const MOCK_SECRET = env.PAYMENT_MOCK_SECRET ?? "";

export interface MockSignablePayload {
  orderNo: string;
  amountCents: number;
  transactionId: string;
  /** ISO8601 字符串；paidAt 参与签名以避免捕获回调被改写后重放。 */
  paidAt: string;
}

export function buildMockCanonical(payload: MockSignablePayload): string {
  // 显式 key 顺序，避免不同 runtime 下 JSON.stringify 输出差异。
  return `orderNo=${payload.orderNo}&amountCents=${payload.amountCents}&transactionId=${payload.transactionId}&paidAt=${payload.paidAt}`;
}

export function signMockPayload(payload: MockSignablePayload): string {
  return createHmac("sha256", MOCK_SECRET)
    .update(buildMockCanonical(payload))
    .digest("hex");
}

export const mockProvider: PaymentProvider = {
  id: "MOCK",
  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const transactionId = `mock_${input.orderNo}`;
    // 用户跳回 /checkout/{orderNo}?provider=mock；checkout 页识别 provider=mock 后渲染"模拟支付"按钮。
    const sep = input.returnUrl.includes("?") ? "&" : "?";
    return {
      paymentUrl: `${input.returnUrl}${sep}provider=mock`,
      transactionId,
      raw: { mock: true, createdAt: new Date().toISOString() },
    };
  },
  async queryStatus(): Promise<QueryChargeResult> {
    // mock 不维护服务端态；状态推动由 markOrderPaid 完成。
    return { status: "PENDING" };
  },
  async refund(input: RefundInput): Promise<RefundResult> {
    // Stage 10.4：mock 不做实际转账，仅回声 refund 元数据用于测试断言。
    return {
      ok: true,
      raw: {
        mock: true,
        refundedAt: new Date().toISOString(),
        idempotencyKey: input.idempotencyKey,
        amountCents: input.amountCents,
        originalAmountCents: input.originalAmountCents,
      },
    };
  },
  async verifyWebhook(raw: string, headers: Headers): Promise<WebhookEvent | null> {
    if (!MOCK_SECRET) return null;
    try {
      const body = JSON.parse(raw) as {
        orderNo?: unknown;
        amountCents?: unknown;
        transactionId?: unknown;
        paidAt?: unknown;
      };
      if (
        typeof body.orderNo !== "string" ||
        typeof body.amountCents !== "number" ||
        typeof body.transactionId !== "string" ||
        typeof body.paidAt !== "string"
      ) {
        return null;
      }
      const expected = signMockPayload({
        orderNo: body.orderNo,
        amountCents: body.amountCents,
        transactionId: body.transactionId,
        paidAt: body.paidAt,
      });
      const provided = headers.get("x-mock-signature") ?? "";
      const a = Buffer.from(provided, "hex");
      const b = Buffer.from(expected, "hex");
      if (a.length !== b.length || a.length === 0 || !timingSafeEqual(a, b)) {
        return null;
      }
      const paidAtDate = new Date(body.paidAt);
      if (Number.isNaN(paidAtDate.getTime())) return null;
      return {
        type: "ORDER_PAID",
        orderNo: body.orderNo,
        transactionId: body.transactionId,
        amountCents: body.amountCents,
        paidAt: paidAtDate,
        raw: body,
      };
    } catch {
      return null;
    }
  },
};
