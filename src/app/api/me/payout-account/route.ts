import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import { createRateLimiter } from "@/lib/rate-limit";
import { getPayoutAccount, updatePayoutAccount } from "@/lib/commerce/payouts";
import { UpdatePayoutAccountSchema } from "@/lib/commerce/schemas";

// 防止误循环 / 撞库枚举 — 30/h 足够日常变更。
const updateLimiter = createRateLimiter({
  limit: 30,
  windowMs: 60 * 60 * 1000,
  name: "收款账号更新",
});

/** GET /api/me/payout-account — 读取当前用户绑定的收款账号。 */
export async function GET() {
  try {
    const user = await requireAuth();
    const account = await getPayoutAccount(user.id);
    return success(account);
  } catch (err) {
    return error(err);
  }
}

/** PUT /api/me/payout-account — 绑定 / 更新收款账号；三字段同时必填。 */
export async function PUT(request: Request) {
  try {
    const user = await requireAuth();
    updateLimiter.check(user.id);
    const body = await request.json().catch(() => ({}));
    const parsed = UpdatePayoutAccountSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    const account = await updatePayoutAccount(user.id, parsed.data);
    return success(account, "收款账号已更新");
  } catch (err) {
    return error(err);
  }
}
