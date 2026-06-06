import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { listMyOrders } from "@/lib/commerce/order-queries";
import { ORDER_STATUSES, type OrderStatusValue } from "@/lib/commerce/schemas";

/**
 * GET /api/me/orders?status=&page=&pageSize=
 * 仅返回当前登录用户的订单；不分享给 admin（admin 走 /api/admin/orders）。
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status") ?? undefined;
    let status: OrderStatusValue | undefined;
    if (rawStatus) {
      if (!(ORDER_STATUSES as readonly string[]).includes(rawStatus)) {
        throw new ValidationError("非法 status 参数");
      }
      status = rawStatus as OrderStatusValue;
    }
    const { page, pageSize } = parsePagination(url);
    const { items, total } = await listMyOrders({
      userId: user.id,
      status,
      page,
      pageSize,
    });
    return success(paginatedResponse(items, total, page, pageSize));
  } catch (err) {
    return error(err);
  }
}
