import { timingSafeEqual } from "node:crypto";

import { expireStalePendingOrders } from "@/lib/commerce/orders";
import { error, success } from "@/lib/response";
import { ForbiddenError } from "@/lib/errors";

/**
 * Stage 10.3 · 内部 cron 入口：批量过期 PENDING 单。
 *
 * 鉴权：必须带 `Authorization: Bearer <CRON_SECRET>`，且 CRON_SECRET 已配置；
 *      未配置 → 始终 403。timingSafeEqual 避免长度泄漏。
 *
 * 同时导出 GET 与 POST：Vercel Cron 默认发 GET，外部 cron 可用 POST。
 *
 * 触发方式：
 *  - Vercel Cron：vercel.json 配 `{ "crons": [{ "path": "/api/cron/expire-orders?...", "schedule": "*\/5 * * * *" }] }`
 *    Vercel 会带 `Authorization: Bearer $CRON_SECRET`（由 Vercel 平台注入）。
 *  - 外部 cron / 手动：`curl -X POST -H "Authorization: Bearer $CRON_SECRET" .../api/cron/expire-orders`
 */
async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ForbiddenError("cron 未启用");
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ForbiddenError("cron 鉴权失败");
  }
  const result = await expireStalePendingOrders();
  return success(result, `已过期 ${result.canceled} 条 PENDING 单`);
}

export async function GET(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    return error(err);
  }
}

export async function POST(request: Request) {
  try {
    return await handle(request);
  } catch (err) {
    return error(err);
  }
}
