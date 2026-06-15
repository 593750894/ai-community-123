import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import {
  assertDownloadable,
  checkMintRateLimit,
  signDownloadToken,
} from "@/lib/commerce/download";
import { ORDER_NO_RE } from "@/lib/commerce/orders";

interface RouteContext {
  params: Promise<{ orderNo: string }>;
}

/**
 * POST /api/orders/:orderNo/download-url
 *
 * Stage 16.5：签发付费工作流的短期下载 URL。
 *
 * - 仅订单本人可访问（非本人 → 404 防订单号枚举）。
 * - 仅 status=PAID 且 refundCents=0 的工作流单可签发；其他状态 → 403 / 404。
 * - 签发的 url 是相对路径 `/api/orders/{orderNo}/download?t=<token>`，由客户端跳转或 fetch。
 *   token TTL 5min；过期后客户端需重新调用本接口拿新 token。
 *
 * Method 用 POST：mint 算作「副作用」（rate-limit 计数 + 客户端理应只在用户主动点击时调用）。
 * 实际未来若加 AuditLog，统一在这里挂；目前先只走 rate-limit。
 */
export async function POST(_req: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth();
    const { orderNo } = await params;
    if (!ORDER_NO_RE.test(orderNo)) throw new NotFoundError("订单");

    checkMintRateLimit(user.id);
    // 业务层校验：PAID + 非退款 + workflowItem 已上传文件
    await assertDownloadable(orderNo, user.id);

    const signed = signDownloadToken({ orderNo, userId: user.id });
    return success({
      url: signed.url,
      expiresAt: signed.expiresAt,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      // 已付款但已退款 → 业务上能区分；告诉用户原因。
      return error(err);
    }
    return error(err);
  }
}
