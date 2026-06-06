import { requireAuth } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import { ORDER_NO_RE } from "@/lib/commerce/orders";

interface RouteContext {
  params: Promise<{ orderNo: string }>;
}

/**
 * GET /api/orders/:orderNo/jsapi-invoke
 *
 * Stage 10.3 · WeChat Pay JSAPI 唤起 SDK 所需的 6 字段签名负载。
 * - 仅订单本人可访问（非本人 → 404 防订单号枚举）。
 * - paySign 永远不会出现在 URL / Referer / 主订单接口；只能从这里取。
 * - 仅 PENDING 单返回；PAID / CANCELED / FAILED 返回 400。
 */
export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth();
    const { orderNo } = await params;
    if (!ORDER_NO_RE.test(orderNo)) throw new NotFoundError("订单");
    const order = await prisma.order.findUnique({
      where: { orderNo },
      select: {
        userId: true,
        status: true,
        metadata: true,
      },
    });
    if (!order) throw new NotFoundError("订单");
    if (order.userId !== user.id) throw new NotFoundError("订单");
    if (order.status !== "PENDING") {
      throw new ValidationError("订单当前状态不可发起 JSAPI 支付");
    }
    const meta = order.metadata as Record<string, unknown> | null;
    const payload = meta?.jsapiInvoke as
      | {
          appId: string;
          timeStamp: string;
          nonceStr: string;
          package: string;
          signType: string;
          paySign: string;
        }
      | undefined;
    if (!payload || !payload.paySign) {
      throw new ValidationError("当前订单不是 JSAPI 单或缺少 SDK 签名");
    }
    return success(payload);
  } catch (err) {
    if (err instanceof ForbiddenError) return error(new NotFoundError("订单"));
    return error(err);
  }
}
