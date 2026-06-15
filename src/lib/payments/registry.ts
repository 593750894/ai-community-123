import type { PaymentMethod } from "@/generated/prisma/client";

import { IS_ALIPAY_ENABLED, alipayProvider } from "./alipay";
import { IS_MOCK_ENABLED, mockProvider } from "./mock";
import { IS_WECHAT_ENABLED, wechatProvider } from "./wechat";
import type { PaymentProvider, ProviderId } from "./types";

/**
 * 渠道 → provider 路由表。
 *
 * Stage 10.3：
 * - Mock 仍可注册（开发态默认启用 / 生产显式 PAYMENT_MOCK_ENABLED=true）。
 * - 微信 / 支付宝在凭据齐全时各自注册一条。
 * - 下单走 getProviderForMethod 分发；webhook 走 providerSlug 反查（path 段 lowercase）。
 *
 * 优先级：真实渠道凭据存在 → 走真实；否则若 mock 启用 → 走 mock；都没 → 返回 null（API 友好报错）。
 */

const WEBHOOK_REGISTRY = new Map<string, PaymentProvider>();
if (IS_MOCK_ENABLED) {
  WEBHOOK_REGISTRY.set("MOCK", mockProvider);
  // 启动日志便于运维核对：mock 在 prod 启用是高风险配置，应在 boot log 中显眼。
  console.warn("[payments] mock provider registered (PAYMENT_MOCK_ENABLED=true)");
}
if (IS_WECHAT_ENABLED) WEBHOOK_REGISTRY.set("WECHAT_PAY", wechatProvider);
if (IS_ALIPAY_ENABLED) WEBHOOK_REGISTRY.set("ALIPAY", alipayProvider);

/** 前端可选的支付方式（Stage 10.3：始终是微信 + 支付宝；底层会按需 fallback 到 mock）。 */
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
  switch (method) {
    case "WECHAT_PAY":
      if (IS_WECHAT_ENABLED) return wechatProvider;
      return IS_MOCK_ENABLED ? mockProvider : null;
    case "ALIPAY":
      if (IS_ALIPAY_ENABLED) return alipayProvider;
      return IS_MOCK_ENABLED ? mockProvider : null;
    case "STRIPE":
    case "MANUAL":
    default:
      return null;
  }
}

/** Webhook URL 段（小写）。 */
export function providerSlug(provider: PaymentProvider): string {
  return String(provider.id).toLowerCase();
}
