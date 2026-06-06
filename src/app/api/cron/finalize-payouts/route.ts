import { timingSafeEqual } from "node:crypto";

import { finalizePendingPayouts } from "@/lib/commerce/payouts";
import { ForbiddenError } from "@/lib/errors";
import { error, success } from "@/lib/response";

/**
 * Stage 10.5 · 内部 cron 入口：批量把冷藏期结束的 PENDING 结算单 → AVAILABLE。
 *
 * 鉴权：必须带 `Authorization: Bearer <CRON_SECRET>`；CRON_SECRET 未配置 → 始终 403。
 * timingSafeEqual 避免长度泄漏。同时导出 GET / POST 适配 Vercel Cron + 外部 cron / curl。
 *
 * 建议调度间隔：每 5-10 分钟。冷藏期为 7 天，对短时间 jitter 不敏感。
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
  const result = await finalizePendingPayouts();
  return success(result, `已结算 ${result.finalized} 条 PENDING payout`);
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
