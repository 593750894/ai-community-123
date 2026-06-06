/**
 * Stage 10.5：商业化运行时配置。
 *
 * 集中读取与 payouts / 订单相关的环境变量；模块加载期校验取值范围，
 * 避免在写入金额时才发现配置非法。
 *
 * 配置项：
 *   - PLATFORM_FEE_BPS：平台抽成（基点；3000 = 30%）。
 *     - 范围 [0, 5000]。0 = 不抽成，5000 = 50% 上限（防止误填 30000 把卖家吃光）。
 *     - 缺失时默认 3000。
 *   - PAYOUT_HOLD_DAYS：付款后到结算单 AVAILABLE 的冷藏期（天）。
 *     - 范围 [0, 90]。MVP 默认 7 天。
 *
 * 这些值同时影响：
 *   - 新订单 markOrderPaid 时的 Payout 行（grossCents/platformFeeCents/netCents/availableAt）
 *   - /pricing 创作者计划页文案
 * 已存在的 Payout 行金额不会因为环境变量变动而回写。
 */

function readIntEnv(name: string, defaultValue: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw new Error(`环境变量 ${name} 必须是整数，实际值：${raw}`);
  }
  if (n < min || n > max) {
    throw new Error(
      `环境变量 ${name} 必须在 [${min}, ${max}] 范围内，实际值：${n}`,
    );
  }
  return n;
}

export const PLATFORM_FEE_BPS = readIntEnv(
  "PLATFORM_FEE_BPS",
  3000, // 30%
  0,
  5000, // 50% 上限
);

export const PAYOUT_HOLD_DAYS = readIntEnv(
  "PAYOUT_HOLD_DAYS",
  7,
  0,
  90,
);

/** 平台抽成百分比，UI 文案用（带 1 位小数）。 */
export const PLATFORM_FEE_PERCENT_DISPLAY =
  (PLATFORM_FEE_BPS / 100).toFixed(PLATFORM_FEE_BPS % 100 === 0 ? 0 : 1);

/** 计算平台抽成金额（分），floor 保留卖家利益。 */
export function calcPlatformFeeCents(grossCents: number): number {
  return Math.floor((grossCents * PLATFORM_FEE_BPS) / 10_000);
}

/** 计算结算单可分发的净额（分）= gross - 平台抽成。 */
export function calcNetCents(grossCents: number): number {
  return grossCents - calcPlatformFeeCents(grossCents);
}

/** 给定付款时间，返回结算单 AVAILABLE 的时间点。 */
export function calcAvailableAt(paidAt: Date): Date {
  return new Date(paidAt.getTime() + PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
}
