import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { listMyPayouts } from "@/lib/commerce/payouts";
import {
  PAYOUT_STATUSES,
  type PayoutStatusValue,
} from "@/lib/commerce/schemas";

/** GET /api/me/payouts?status=&page=&pageSize= — 当前用户结算单列表。 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status") ?? undefined;
    let status: PayoutStatusValue | undefined;
    if (rawStatus) {
      if (!(PAYOUT_STATUSES as readonly string[]).includes(rawStatus)) {
        throw new ValidationError("非法 status 参数");
      }
      status = rawStatus as PayoutStatusValue;
    }
    const { page, pageSize } = parsePagination(url);
    const { items, total } = await listMyPayouts({
      sellerId: user.id,
      status,
      page,
      pageSize,
    });
    return success(paginatedResponse(items, total, page, pageSize));
  } catch (err) {
    return error(err);
  }
}
