import { timingSafeEqual } from "node:crypto";

import { reconcileStalePendingRefunds } from "@/lib/commerce/refunds";
import { env } from "@/lib/env";
import { error, success } from "@/lib/response";
import { ForbiddenError } from "@/lib/errors";

/**
 * Stage 18.0 · 内部 cron 入口：扫描 PENDING > 1h 的 Refund 行，给 admin 发系统通知。
 *
 * 鉴权与 expire-orders 同：Authorization: Bearer $CRON_SECRET + timingSafeEqual。
 * 触发频率：建议每小时一次（`0 * * * *`）；24h dedup 控制单 refund 推送频次。
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
  const result = await reconcileStalePendingRefunds();
  return success(
    result,
    `扫描 ${result.scanned} 笔陈旧 PENDING 退款，新通知 ${result.notified} 笔`,
  );
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
