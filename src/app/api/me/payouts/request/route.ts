import { requireAuth } from "@/lib/auth/guard";
import { error, success } from "@/lib/response";
import { createRateLimiter } from "@/lib/rate-limit";
import { cancelPayoutRequest, requestPayout } from "@/lib/commerce/payouts";

// 卖家点提现的频率不会太高；10/小时防误点循环。
const requestLimiter = createRateLimiter({
  limit: 10,
  windowMs: 60 * 60 * 1000,
  name: "提现申请",
});

/**
 * POST /api/me/payouts/request
 * 把当前用户所有 AVAILABLE 且未申请的结算单标记 requestedAt=now。
 * - 未绑定收款账号 → 400
 * - 没有可申请的 → 409
 */
export async function POST() {
  try {
    const user = await requireAuth();
    requestLimiter.check(user.id);
    const result = await requestPayout(user.id);
    return success(result, `已提交 ${result.requested} 笔提现申请`);
  } catch (err) {
    return error(err);
  }
}

/**
 * DELETE /api/me/payouts/request
 * 撤回所有「已申请但未打款」的提现请求（requestedAt 设回 null）。
 * 仅状态仍为 AVAILABLE 的行可撤回；已 PAID / CANCELED 行不受影响。
 */
export async function DELETE() {
  try {
    const user = await requireAuth();
    requestLimiter.check(user.id);
    const result = await cancelPayoutRequest(user.id);
    return success(result, `已撤回 ${result.canceled} 笔提现申请`);
  } catch (err) {
    return error(err);
  }
}
