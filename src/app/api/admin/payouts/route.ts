import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import {
  getAdminPayoutOverview,
  listPayoutsForAdmin,
} from "@/lib/commerce/payouts";
import {
  PAYOUT_STATUSES,
  type PayoutStatusValue,
} from "@/lib/commerce/schemas";

/**
 * GET /api/admin/payouts?status=&pendingRequest=1&q=&page=
 * 仅 ADMIN；overview 给后台总览页用，含分状态净额聚合。
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();
    const url = new URL(request.url);
    const sp = url.searchParams;
    const rawStatus = sp.get("status") ?? undefined;
    let status: PayoutStatusValue | undefined;
    if (rawStatus && (PAYOUT_STATUSES as readonly string[]).includes(rawStatus)) {
      status = rawStatus as PayoutStatusValue;
    }
    const pendingRequest = sp.get("pendingRequest") === "1";
    const q = (sp.get("q") ?? "").trim() || undefined;
    const { page, pageSize } = parsePagination(url);
    const [{ items, total }, overview] = await Promise.all([
      listPayoutsForAdmin({ status, pendingRequest, q, page, pageSize }),
      getAdminPayoutOverview(),
    ]);
    return success({
      ...paginatedResponse(items, total, page, pageSize),
      overview,
    });
  } catch (err) {
    return error(err);
  }
}
