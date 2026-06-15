import { AppError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import {
  assertDownloadable,
  checkRedeemRateLimit,
  extractClientIp,
  recordDownloadGrant,
  verifyDownloadToken,
} from "@/lib/commerce/download";
import { ORDER_NO_RE } from "@/lib/commerce/orders";

interface RouteContext {
  params: Promise<{ orderNo: string }>;
}

/**
 * GET /api/orders/:orderNo/download?t=<token>
 *
 * Stage 16.5：付费工作流下载兑换。
 *
 * 兑换流程：
 *   1. 解析 query `t` → HMAC + 时效 + 版本（verifyDownloadToken）
 *   2. token.o / token.u 与 URL orderNo / DB order.userId 强绑定校验
 *   3. assertDownloadable：从 DB 重新读 PAID + refundCents=0 + 文件就绪
 *   4. 写一行 DownloadGrant 审计
 *   5. 302 到 workflow_items.download_url（不返回 200 + body，避免下载器再做一跳）
 *
 * 安全说明：本端点**不依赖 session cookie**。token 即是凭据，使其在跨上下文（下载器 / 移动 webview）
 * 中可用，且 cookie 单独泄漏无法直接利用。token 与 orderNo 绑定 + 与 userId 绑定 + 与 DB 订单状态绑定，
 * 三层共同生效；任意一层不匹配都返回非 200。
 *
 * 错误码语义：
 *   - 401 UNAUTHORIZED：token 缺失 / 签名错误 / 过期 — 让客户端重发 POST /download-url。
 *   - 403 FORBIDDEN：订单存在且持有人正确，但已退款 / 状态非 PAID。
 *   - 404 NOT_FOUND：订单不存在 / 持有人不匹配 / 文件未配置 — 屏蔽信息差。
 *   - 429 RATE_LIMITED：超过每 IP 每 orderNo 60次/分钟。
 *
 * 不返回 JSON：错误情况下我们仍走 error() 走 JSON，因为下载兑换失败的 UI 入口是页面而非命令行。
 * 客户端 fetch 兑换 → 服务端 302 时浏览器自动跟随；客户端不需自己处理 302。
 *
 * **未来 P1**：若改为服务端代签云存储 URL（S3 / R2 / COS sigv4），保留本端点形态，仅把 final 302 目标
 * 改为云端临时 URL，并把 TTL 与 token TTL 对齐。本期 P0 暂不引入云 SDK 依赖，直接 302 到卖家裸 URL。
 */
export async function GET(req: Request, { params }: RouteContext) {
  try {
    const { orderNo } = await params;
    if (!ORDER_NO_RE.test(orderNo)) throw new NotFoundError("订单");

    const ip = extractClientIp(req.headers);

    // 先做 HMAC + 时效校验（CPU O(μs)，无 DB）。仅在校验通过后再扣 redeem 限流计数；
    // 否则未持有合法 token 的攻击者可拿坏 token 灌爆 `orderNo|anonymous` 桶，
    // 把同 orderNo 的合法兑换打成 429。
    const url = new URL(req.url);
    const token = url.searchParams.get("t");
    const verified = verifyDownloadToken(token);

    // token 与 URL path 必须一致 — 否则攻击者可以把别处签的 token 改 path 复用。
    if (verified.orderNo !== orderNo) {
      throw new UnauthorizedError("下载链接与订单不匹配");
    }

    checkRedeemRateLimit(orderNo, ip ?? "");

    // DB 复核 — 比对当前 order.userId == token.userId（屏蔽订单存在性，统一 404）。
    const order = await assertDownloadable(orderNo, verified.userId);

    // 审计：仅在以上全部通过后落库。
    await recordDownloadGrant({
      orderId: order.orderId,
      userId: order.buyerId,
      token: verified,
      ip,
      userAgent: req.headers.get("user-agent"),
    });

    // 302 跳转到卖家裸 URL。Cache-Control: no-store 防止 CDN / 浏览器缓存重定向响应本身，
    // 否则同 token 的失败 redeem（refund 后）可能被缓存为 302 → 用户绕过最新状态。
    return new Response(null, {
      status: 302,
      headers: {
        Location: order.rawDownloadUrl,
        "Cache-Control": "no-store, max-age=0",
        // Referrer-Policy: 不把签名 token 写进下游 Referer 头 — 卖家裸 URL 收到的 Referer 不应包含 ?t=
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (err) {
    return errorJsonForDownload(err);
  }
}

/**
 * 复用 response.error()，但避免在该 route 顶部 import 让 GET 看上去太杂；
 * 内联薄包装方便后续切到「错误重定向到落地页」时只改这一处。
 */
function errorJsonForDownload(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      {
        success: false,
        error: { code: err.code, message: err.message },
      },
      { status: err.statusCode },
    );
  }
  return Response.json(
    {
      success: false,
      error: { code: "INTERNAL_ERROR", message: "服务器内部错误" },
    },
    { status: 500 },
  );
}
