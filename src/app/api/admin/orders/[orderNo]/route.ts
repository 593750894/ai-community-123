import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import { getOrderForAdmin } from "@/lib/commerce/order-queries";
import { ORDER_NO_RE } from "@/lib/commerce/orders";

/** GET /api/admin/orders/:orderNo — 单订单详情 + 退款列表（admin only）。 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();
    const { orderNo } = await params;
    if (!ORDER_NO_RE.test(orderNo)) throw new NotFoundError("订单");
    const order = await getOrderForAdmin(orderNo);
    if (!order) throw new NotFoundError("订单");
    return success(order);
  } catch (err) {
    return error(err);
  }
}
