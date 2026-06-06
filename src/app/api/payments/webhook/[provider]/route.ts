import { NotFoundError, ValidationError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import { markOrderPaid } from "@/lib/commerce/orders";
import { getProvider } from "@/lib/payments/registry";

interface RouteContext {
  params: Promise<{ provider: string }>;
}

/**
 * POST /api/payments/webhook/:provider
 *
 * Stage 10.2：provider=mock 由 mockProvider 解析 HMAC 签名（header x-mock-signature）。
 * Stage 10.3 会再注册 wechat / alipay；其它 provider 名一律 404。
 *
 * 验签失败 → 400。markOrderPaid 内部 updateMany WHERE status=PENDING，
 * 重复回调（webhook 重放）落空更新 → 当 alreadyPaid 静默成功。
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { provider: providerId } = await params;
    const provider = getProvider(providerId);
    if (!provider) throw new NotFoundError("支付渠道");

    const raw = await request.text();
    const event = await provider.verifyWebhook(raw, request.headers);
    if (!event) throw new ValidationError("回调验签失败");

    if (event.type === "ORDER_PAID") {
      await markOrderPaid({
        orderNo: event.orderNo,
        transactionId: event.transactionId,
        amountCents: event.amountCents,
        paidAt: event.paidAt,
        callbackPayload: event.raw,
      });
    }
    return success({ received: true });
  } catch (err) {
    return error(err);
  }
}
