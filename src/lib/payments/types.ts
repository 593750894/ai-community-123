import type { PaymentMethod } from "@/generated/prisma/client";

/**
 * Stage 10.2：支付适配抽象。
 *
 * 设计：
 * - 一个 PaymentProvider 对应一种支付渠道（mock / 微信 / 支付宝 / Stripe）。
 * - createCharge 返回付款链接（用户跳转 / 扫码扫描）和第三方订单号。
 * - queryStatus 用于轮询兜底（webhook 才是主路径）。
 * - verifyWebhook 在 API 层验签 + 解析；不通过返 null。
 * - refund 暂留接口，Stage 10.4 真正用到。
 */

export type ProviderId = "MOCK" | PaymentMethod;

export type ChargeStatus = "PENDING" | "PAID" | "FAILED" | "CANCELED";

export interface CreateChargeInput {
  orderNo: string;
  amountCents: number;
  currency: string;
  subject: string;
  /** 描述：会员档位 / 商品名等，供应商通常在收银台展示。 */
  description?: string;
  /** 用户付款完成后回到的内部页面。 */
  returnUrl: string;
  /** 异步通知地址（webhook）。 */
  notifyUrl: string;
  /** 30 分钟超时。 */
  expiresAt: Date;
  /** 透传给 webhook 的业务数据。 */
  attach?: Record<string, string | number>;
}

export interface CreateChargeResult {
  /** 用户跳转 / 扫码用的链接；mock 走站内 /checkout 自身。 */
  paymentUrl: string;
  /** 第三方分配的订单号；mock 自生成 mock_xxx。 */
  transactionId: string;
  /** 可选：原始响应，落 callback_payload 备查。 */
  raw?: unknown;
}

export interface QueryChargeResult {
  status: ChargeStatus;
  transactionId?: string;
  paidAt?: Date;
  amountCents?: number;
  raw?: unknown;
}

export interface RefundInput {
  orderNo: string;
  transactionId: string | null;
  amountCents: number;
  reason?: string;
}

export interface RefundResult {
  ok: boolean;
  message?: string;
  raw?: unknown;
}

/** 已验签 + 校验过的 webhook 事件。 */
export interface WebhookEvent {
  type: "ORDER_PAID" | "ORDER_REFUNDED" | "UNKNOWN";
  orderNo: string;
  transactionId: string;
  amountCents: number;
  paidAt: Date;
  raw: unknown;
}

export interface PaymentProvider {
  id: ProviderId;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  queryStatus(transactionId: string, orderNo: string): Promise<QueryChargeResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  /**
   * 解析 webhook 原文 + 验签。返回 null 即视为非法 / 未通过验签。
   * raw 是 string（保留原始字节用于签名比对），headers 是请求头副本。
   */
  verifyWebhook(raw: string, headers: Headers): Promise<WebhookEvent | null>;
}
