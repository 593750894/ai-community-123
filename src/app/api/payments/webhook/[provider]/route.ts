import { createHash } from "node:crypto";

import { Prisma, prisma } from "@/lib/db";
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
 * 验签失败 → 400。
 *
 * 阶段 16.1：webhook 幂等。流程：
 *   1. verifyWebhook 通过 → 得到带 providerEventId 的 event。
 *   2. 用 (provider, providerEventId) upsert webhook_events 表。
 *      - P2002 唯一冲突 = PSP 重发，直接返 200 不再调 markOrderPaid。
 *      - 新行 = 首次到达，往下走。
 *   3. markOrderPaid（内部 updateMany WHERE status=PENDING 二次防御）。
 *   4. 业务处理成功后回填 processed_at。
 */
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { provider: providerId } = await params;
    const provider = getProvider(providerId);
    if (!provider) throw new NotFoundError("支付渠道");

    const raw = await request.text();
    const event = await provider.verifyWebhook(raw, request.headers);
    if (!event) throw new ValidationError("回调验签失败");

    const providerKey = String(provider.id).toUpperCase();
    const rawBodyHash = createHash("sha256").update(raw).digest("hex");

    // 幂等策略：
    // - 首次到达：create 成功 → 走业务流程。
    // - P2002 + 既有行 processed_at != null：真正 replay，short-circuit 返 200。
    // - P2002 + 既有行 processed_at == null：上一轮业务处理崩了（DB 抖动 / 进程被杀），
    //   复用既有行 id 让 PSP 重发能继续推进而不是被吞掉。
    let webhookEventId: string | null = null;
    try {
      const created = await prisma.webhookEvent.create({
        data: {
          provider: providerKey,
          providerEventId: event.providerEventId,
          orderNo: event.orderNo,
          eventType: event.type,
          rawBodyHash,
        },
        select: { id: true },
      });
      webhookEventId = created.id;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const existing = await prisma.webhookEvent.findUnique({
          where: {
            provider_providerEventId: {
              provider: providerKey,
              providerEventId: event.providerEventId,
            },
          },
          select: { id: true, processedAt: true },
        });
        if (existing?.processedAt) {
          return success({ received: true, replay: true });
        }
        webhookEventId = existing?.id ?? null;
      } else {
        throw err;
      }
    }

    if (event.type === "ORDER_PAID") {
      await markOrderPaid({
        orderNo: event.orderNo,
        transactionId: event.transactionId,
        amountCents: event.amountCents,
        paidAt: event.paidAt,
        callbackPayload: event.raw,
      });
    }

    if (webhookEventId) {
      await prisma.webhookEvent
        .update({
          where: { id: webhookEventId },
          data: { processedAt: new Date() },
        })
        .catch(() => {
          // processed_at 仅 ops 用途；写失败不影响响应。
        });
    }

    return success({ received: true });
  } catch (err) {
    return error(err);
  }
}
