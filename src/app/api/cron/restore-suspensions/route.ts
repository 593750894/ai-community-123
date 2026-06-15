import { timingSafeEqual } from "node:crypto";

import { autoRestoreExpiredSuspensions } from "@/lib/admin/users";
import { env } from "@/lib/env";
import { error, success } from "@/lib/response";
import { ForbiddenError } from "@/lib/errors";

/**
 * Stage 17.5 · cron 入口：批量解除到期的 SUSPENDED 用户。
 *
 * 设计：
 *  - 鉴权同 expire-orders：`Authorization: Bearer $CRON_SECRET` + timingSafeEqual。
 *  - CRON_SECRET 未配置时一律 403，避免误把生产入口暴露。
 *  - 同时导出 GET 与 POST：Vercel Cron 默认 GET，外部 curl/调试用 POST。
 *  - 单次最多处理 500 个候选（updateMany 原子，并发多 cron 安全）；其余下次 tick 处理。
 *
 * 用法（外部）：
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     https://your-host/api/cron/restore-suspensions
 *
 * 用法（Vercel）：
 *   { "crons": [{ "path": "/api/cron/restore-suspensions", "schedule": "*\/5 * * * *" }] }
 */
async function handle(request: Request): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret) throw new ForbiddenError("cron 未启用");
  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ForbiddenError("cron 鉴权失败");
  }
  const result = await autoRestoreExpiredSuspensions();
  return success(result, `已解除 ${result.restored} 个到期禁言`);
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
