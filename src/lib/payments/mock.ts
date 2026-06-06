import { createHmac, timingSafeEqual } from "node:crypto";

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
 * - 默认仅在 NODE_ENV !== "production" 启用。
 * - 生产环境必须显式设置 PAYMENT_MOCK_ENABLED=true 才会启用，并且必须设置
 *   PAYMENT_MOCK_SECRET（否则启动期抛错）。
 * - 启动期校验在模块加载时执行；若违反约束直接抛错让进程拒绝起。
 *
 * Webhook 签名：HMAC-SHA256(secret, "orderNo=...&amountCents=...&transactionId=...&paidAt=...")
 * paidAt 必填且参与签名 → 同一订单的回调不可被改写时间戳重放。
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const MOCK_SECRET_RAW = process.env.PAYMENT_MOCK_SECRET ?? "";
export const IS_MOCK_ENABLED =
  process.env.PAYMENT_MOCK_ENABLED === "true" || !IS_PRODUCTION;

if (IS_PRODUCTION && IS_MOCK_ENABLED && !MOCK_SECRET_RAW) {
  // 拒绝启动：避免回退到 dev 默认 secret 被攻击者用于伪造任何订单的 PAID 回调。
  throw new Error(
    "PAYMENT_MOCK_ENABLED=true requires PAYMENT_MOCK_SECRET to be set in production.",
  );
}

const MOCK_SECRET =
  MOCK_SECRET_RAW || (IS_PRODUCTION ? "" : "seedland-dev-mock-secret");

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
