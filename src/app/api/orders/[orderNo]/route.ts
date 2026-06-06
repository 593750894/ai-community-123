import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import {
  getOrderByNo,
  ORDER_NO_RE,
  refreshOrderStatus,
} from "@/lib/commerce/orders";

interface RouteContext {
  params: Promise<{ orderNo: string }>;
}

/**
 * GET /api/orders/:orderNo — 订单详情（仅本人）。
 * 非本人访问翻 404 防订单号枚举；refreshOrderStatus 当前是 no-op，过期态由展示层判定。
 */
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth();
    const { orderNo } = await params;
    if (!ORDER_NO_RE.test(orderNo)) throw new NotFoundError("订单");
    await refreshOrderStatus(orderNo);
    let order;
    try {
      order = await getOrderByNo(orderNo, user.id);
    } catch (err) {
      // 非本人访问 → 404，不暴露订单存在
      if (err instanceof ForbiddenError) throw new NotFoundError("订单");
      throw err;
    }
    if (!order) throw new NotFoundError("订单");
    return success(order);
  } catch (err) {
    return error(err);
  }
}
