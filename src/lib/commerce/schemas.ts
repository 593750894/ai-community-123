import { z } from "zod";

/**
 * 商业化模块 Zod 校验。
 *
 * - WorkflowItem (创作者上架商品): MVP 仅支持 ComfyUI 工作流 / Prompt 包 / 节点图 / 模板等单文件交付。
 * - MembershipPlan: 用户订阅平台会员（VIP / Pro / Studio）。
 * - Order: 抽象的购买记录，type ∈ {MEMBERSHIP, WORKFLOW_PURCHASE, ...}。
 */

// ───────────────────────────── WorkflowItem ─────────────────────────────

export const WORKFLOW_ITEM_CATEGORIES = [
  "COMFYUI_WORKFLOW", // ComfyUI 工作流
  "PROMPT_PACK",      // Prompt 包
  "NODE_GRAPH",       // 节点图
  "LORA_MODEL",       // LoRA 模型
  "TEMPLATE",         // 模板（剪辑 / 文案 / 项目工程）
  "TUTORIAL_BUNDLE",  // 教程合集
  "OTHER",
] as const;
export type WorkflowItemCategory = (typeof WORKFLOW_ITEM_CATEGORIES)[number];

export const WORKFLOW_ITEM_CATEGORY_LABEL: Record<WorkflowItemCategory, string> = {
  COMFYUI_WORKFLOW: "ComfyUI 工作流",
  PROMPT_PACK: "Prompt 包",
  NODE_GRAPH: "节点图",
  LORA_MODEL: "LoRA 模型",
  TEMPLATE: "模板素材",
  TUTORIAL_BUNDLE: "教程合集",
  OTHER: "其他",
};

export const WORKFLOW_ITEM_STATUSES = [
  "DRAFT",
  "PUBLISHED",
  "SOLD_OUT",
  "ARCHIVED",
] as const;
export type WorkflowItemStatusValue = (typeof WORKFLOW_ITEM_STATUSES)[number];

export const WORKFLOW_ITEM_STATUS_LABEL: Record<WorkflowItemStatusValue, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已上架",
  SOLD_OUT: "已售罄",
  ARCHIVED: "已下架",
};

// 价格上限 9999.99 元 = 999999 分（避免误填导致天文数字）
const MAX_PRICE_CENTS = 999_999;

export const CreateWorkflowItemSchema = z.object({
  title: z.string().trim().min(2, "标题至少 2 个字").max(80, "标题最多 80 个字"),
  description: z
    .string()
    .trim()
    .min(10, "描述至少 10 个字")
    .max(2000, "描述最多 2000 个字"),
  coverUrl: z.string().url("封面必须是合法 URL").max(500).optional().nullable(),
  downloadUrl: z
    .string()
    .url("下载链接必须是合法 URL")
    .max(500)
    .optional()
    .nullable(),
  priceCents: z
    .number({ message: "价格必须是数字" })
    .int("价格必须是整数（分）")
    .min(0, "价格不能为负")
    .max(MAX_PRICE_CENTS, "价格上限 9999.99 元"),
  currency: z.literal("CNY").default("CNY"),
  category: z.enum(WORKFLOW_ITEM_CATEGORIES),
  tags: z
    .array(z.string().trim().min(1).max(20))
    .max(8, "最多 8 个标签")
    .default([]),
  toolStack: z
    .array(z.string().trim().min(1).max(40))
    .max(10, "最多 10 个工具")
    .default([]),
});
export type CreateWorkflowItemInput = z.infer<typeof CreateWorkflowItemSchema>;

export const UpdateWorkflowItemSchema = CreateWorkflowItemSchema.partial();
export type UpdateWorkflowItemInput = z.infer<typeof UpdateWorkflowItemSchema>;

export const WorkflowItemStatusActionSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"], {
    message: "状态非法",
  }),
});
export type WorkflowItemStatusActionInput = z.infer<
  typeof WorkflowItemStatusActionSchema
>;

// ───────────────────────────── MembershipPlan ─────────────────────────────

export const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "ANNUAL", "LIFETIME"] as const;
export type BillingCycleValue = (typeof BILLING_CYCLES)[number];

export const BILLING_CYCLE_LABEL: Record<BillingCycleValue, string> = {
  MONTHLY: "月付",
  QUARTERLY: "季付",
  ANNUAL: "年付",
  LIFETIME: "买断",
};

// ───────────────────────────── Order ─────────────────────────────

export const ORDER_TYPES = [
  "MEMBERSHIP",
  "WORKFLOW_PURCHASE",
  "COLLABORATION_DEPOSIT",
  "CUSTOM",
] as const;
export type OrderTypeValue = (typeof ORDER_TYPES)[number];

export const ORDER_TYPE_LABEL: Record<OrderTypeValue, string> = {
  MEMBERSHIP: "会员订阅",
  WORKFLOW_PURCHASE: "工作流购买",
  COLLABORATION_DEPOSIT: "合作定金",
  CUSTOM: "自定义订单",
};

export const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "CANCELED",
  "REFUNDED",
  "FAILED",
] as const;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatusValue, string> = {
  PENDING: "待付款",
  PAID: "已付款",
  CANCELED: "已取消",
  REFUNDED: "已退款",
  FAILED: "支付失败",
};

export const PAYMENT_METHODS = ["WECHAT_PAY", "ALIPAY", "STRIPE", "MANUAL"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodValue, string> = {
  WECHAT_PAY: "微信支付",
  ALIPAY: "支付宝",
  STRIPE: "Stripe",
  MANUAL: "线下转账",
};

// ───────────────────────────── 工具方法 ─────────────────────────────

/** 价格分→元，避免到处乘除。 */
export function formatPrice(
  cents: number,
  currency: string = "CNY",
): string {
  const symbol = currency === "CNY" ? "¥" : currency + " ";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

/** 元→分（用户输入时反向转换；带 floor 防小数位误差）。 */
export function priceToCents(yuan: number): number {
  if (!Number.isFinite(yuan) || yuan < 0) return 0;
  return Math.floor(yuan * 100 + 0.5);
}

// ───────────────────────── 下单（Stage 10.2） ─────────────────────────

/** 用户可选的支付方式（与 src/lib/payments/registry SELECTABLE_PAYMENT_METHODS 同源）。 */
export const ORDER_PAYMENT_METHODS = ["WECHAT_PAY", "ALIPAY"] as const;
export type OrderPaymentMethodValue = (typeof ORDER_PAYMENT_METHODS)[number];

/**
 * 创建订单的入参。
 * Stage 10.2 仅支持 MEMBERSHIP（按 planSlug）+ WORKFLOW_PURCHASE（按 workflowItemId）。
 * COLLABORATION_DEPOSIT / CUSTOM 留待后续。
 */
export const CreateOrderSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("MEMBERSHIP"),
    planSlug: z.string().trim().min(1, "缺少计划标识").max(64),
    paymentMethod: z.enum(ORDER_PAYMENT_METHODS),
  }),
  z.object({
    type: z.literal("WORKFLOW_PURCHASE"),
    workflowItemId: z.string().trim().min(1, "缺少商品 ID").max(64),
    paymentMethod: z.enum(ORDER_PAYMENT_METHODS),
  }),
]);
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

// ───────────────────────── 退款（Stage 10.4） ─────────────────────────

/**
 * 退款入参：
 * - amountCents 省略 → 全额退剩余可退金额；
 *   - amountCents 显式给 0 / 负数 / 超额 → ValidationError，落地在 refundOrder。
 * - reason 透传到 PSP 与 AuditLog 元数据；为空字符串视为 undefined。
 */
export const RefundOrderSchema = z.object({
  amountCents: z
    .number({ message: "金额必须是数字" })
    .int("金额必须是整数（分）")
    .positive("金额必须大于 0")
    .max(999_999_99, "退款金额上限 999999.99 元")
    .optional(),
  reason: z
    .string()
    .trim()
    .max(200, "原因最多 200 字")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
export type RefundOrderInput = z.infer<typeof RefundOrderSchema>;

// ───────────────────────── 结算 / Payout（Stage 10.5） ────────────────

export const PAYOUT_STATUSES = ["PENDING", "AVAILABLE", "PAID", "CANCELED"] as const;
export type PayoutStatusValue = (typeof PAYOUT_STATUSES)[number];

export const PAYOUT_STATUS_LABEL: Record<PayoutStatusValue, string> = {
  PENDING: "冷藏期中",
  AVAILABLE: "可申请提现",
  PAID: "已打款",
  CANCELED: "已取消（退款）",
};

/** 卖家可绑定的收款方式。MVP 只支持 3 种：支付宝 / 微信 / 银行卡。 */
export const PAYOUT_METHODS = ["ALIPAY", "WECHAT_PAY", "BANK"] as const;
export type PayoutMethodValue = (typeof PAYOUT_METHODS)[number];

export const PAYOUT_METHOD_LABEL: Record<PayoutMethodValue, string> = {
  ALIPAY: "支付宝",
  WECHAT_PAY: "微信",
  BANK: "银行卡",
};

/** 绑定 / 更新卖家收款账号；三字段同时给（全部必填，避免半填状态）。 */
export const UpdatePayoutAccountSchema = z.object({
  payoutMethod: z.enum(PAYOUT_METHODS),
  payoutAccount: z
    .string()
    .trim()
    .min(2, "收款账号至少 2 字")
    .max(64, "收款账号最多 64 字"),
  payoutName: z
    .string()
    .trim()
    .min(2, "收款人姓名至少 2 字")
    .max(64, "收款人姓名最多 64 字"),
});
export type UpdatePayoutAccountInput = z.infer<typeof UpdatePayoutAccountSchema>;

/** admin 标记打款；备注最长 200 字，可空。 */
export const MarkPayoutPaidSchema = z.object({
  note: z
    .string()
    .trim()
    .max(200, "备注最多 200 字")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
export type MarkPayoutPaidInput = z.infer<typeof MarkPayoutPaidSchema>;
