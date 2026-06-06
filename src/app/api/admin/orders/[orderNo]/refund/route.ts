import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import { createRateLimiter } from "@/lib/rate-limit";
import { ORDER_NO_RE } from "@/lib/commerce/orders";
import { refundOrder } from "@/lib/commerce/refunds";
import { RefundOrderSchema } from "@/lib/commerce/schemas";

// admin 自己手动操作的频率不会太高，但拦住误循环；50/分钟够日常运营。
const refundLimiter = createRateLimiter({
  limit: 50,
  windowMs: 60_000,
  name: "订单退款",
});

/**
 * POST /api/admin/orders/:orderNo/refund
 * Body: { amountCents?: number, reason?: string }
 *
 * - amountCents 省略 = 全额退剩余可退；显式给金额则部分退款。
 * - 仅 ADMIN 可调；非 admin → 403。
 * - 订单非 PAID / 渠道未启用 / 超额 → 400。
 * - PSP 拒绝（验签失败 / 网络错误）→ 502 + Refund 行 status=FAILED。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();
    refundLimiter.check(user.id);

    const { orderNo } = await params;
    if (!ORDER_NO_RE.test(orderNo)) throw new NotFoundError("订单");

    const body = await request.json().catch(() => ({}));
    const parsed = RefundOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    const result = await refundOrder({
      orderNo,
      adminId: user.id,
      amountCents: parsed.data.amountCents,
      reason: parsed.data.reason,
    });
    return success(result, "退款已受理");
  } catch (err) {
    return error(err);
  }
}
