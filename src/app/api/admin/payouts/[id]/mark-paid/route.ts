import { createAuditLog } from "@/lib/admin/audit";
import { requireAuth } from "@/lib/auth/guard";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { error, success } from "@/lib/response";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  getPayoutForAdmin,
  markPayoutPaid,
} from "@/lib/commerce/payouts";
import { MarkPayoutPaidSchema } from "@/lib/commerce/schemas";

const markPaidLimiter = createRateLimiter({
  limit: 100,
  windowMs: 60_000,
  name: "结算单标记打款",
});

/**
 * POST /api/admin/payouts/[id]/mark-paid
 * 仅 ADMIN；只能对 AVAILABLE 状态结算单操作。
 * - body 可带 note：备注（流水号 / 备忘），≤200 字。
 * - 已 PAID / CANCELED → 400；并发被另一 admin 抢先 → 409。
 * - 卖家未绑定收款账号 → 400（避免打错账户）。
 * - 成功后落 AuditLog + 推 PAYOUT_PAID 通知给卖家。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();
    markPaidLimiter.check(user.id);

    const { id } = await params;
    if (!id) throw new NotFoundError("结算单");

    const body = await request.json().catch(() => ({}));
    const parsed = MarkPayoutPaidSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }

    const before = await getPayoutForAdmin(id);
    if (!before) throw new NotFoundError("结算单");

    const result = await markPayoutPaid({
      payoutId: id,
      adminId: user.id,
      note: parsed.data.note,
    });

    await createAuditLog({
      adminId: user.id,
      action: "PAYOUT_MARK_PAID",
      targetType: "Payout",
      targetId: result.payoutId,
      metadata: {
        payoutId: result.payoutId,
        orderNo: before.orderNo,
        sellerId: result.sellerId,
        sellerUsername: before.seller.username,
        netCents: result.netCents,
        grossCents: before.grossCents,
        platformFeeCents: before.platformFeeCents,
        currency: result.currency,
        payoutMethod: before.sellerAccount.payoutMethod,
        payoutAccount: before.sellerAccount.payoutAccount,
        payoutName: before.sellerAccount.payoutName,
        note: parsed.data.note ?? null,
      },
    });

    return success(result, "结算单已标记为已打款");
  } catch (err) {
    return error(err);
  }
}
