import { requireAuth } from "@/lib/auth/guard";
import { error, success } from "@/lib/response";
import { getEarningsSummary } from "@/lib/commerce/payouts";

/**
 * GET /api/me/earnings
 * 当前登录用户的卖家收益汇总（含所有状态金额聚合 + 收款账号 + 平台费率 / 冷藏期）。
 * 非卖家也能调（数字全 0），UI 在收益页统一展示。
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const summary = await getEarningsSummary(user.id);
    return success(summary);
  } catch (err) {
    return error(err);
  }
}
