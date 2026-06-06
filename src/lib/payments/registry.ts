import type { PaymentMethod } from "@/generated/prisma/client";

import { IS_MOCK_ENABLED, mockProvider } from "./mock";
import type { PaymentProvider, ProviderId } from "./types";

/**
 * 渠道 → provider 路由表。
 *
 * Stage 10.2：仅 mock 注册在路由表中，且只有当 IS_MOCK_ENABLED=true 时才注册。
 * 生产环境若未显式开启 PAYMENT_MOCK_ENABLED，则下单会因为没有 provider 直接 fail-fast，
 * 避免 fallback secret 被攻击者利用。
 *
 * Stage 10.3 将注册 wechat / alipay provider。
 */

const WEBHOOK_REGISTRY = new Map<string, PaymentProvider>();
if (IS_MOCK_ENABLED) {
  WEBHOOK_REGISTRY.set("MOCK", mockProvider);
}

/** 给前端选支付方式时用：Stage 10.2 仅放微信 / 支付宝（统一走 mock）。 */
export const SELECTABLE_PAYMENT_METHODS = ["WECHAT_PAY", "ALIPAY"] as const;
export type SelectablePaymentMethod = (typeof SELECTABLE_PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_DISPLAY: Record<SelectablePaymentMethod, string> = {
  WECHAT_PAY: "微信支付",
  ALIPAY: "支付宝",
};

/** Webhook 路由用：providerId 大写。 */
export function getProvider(id: ProviderId | string): PaymentProvider | null {
  return WEBHOOK_REGISTRY.get(String(id).toUpperCase()) ?? null;
}

/** 下单时根据用户选的 PaymentMethod 拿对应 provider；未启用渠道返回 null。 */
export function getProviderForMethod(
  method: PaymentMethod,
): PaymentProvider | null {
  // Stage 10.2：所有渠道暂时统一走 mock；Stage 10.3 后改成 switch(method) → wechat / alipay。
  void method;
  return IS_MOCK_ENABLED ? mockProvider : null;
}

/** Webhook URL 段（小写）。 */
export function providerSlug(provider: PaymentProvider): string {
  return String(provider.id).toLowerCase();
}
