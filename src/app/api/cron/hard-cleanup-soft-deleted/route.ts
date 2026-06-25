import { timingSafeEqual } from "node:crypto";

import { hardCleanupSoftDeleted } from "@/lib/content/soft-delete";
import { env } from "@/lib/env";
import { error, success } from "@/lib/response";
import { ForbiddenError } from "@/lib/errors";

/**
 * Stage 18.0 · 内部 cron 入口：物理删除超过 30 天的 soft-deleted 内容（且无 PENDING 申诉）。
 *
 * 鉴权与其它 cron 同：Authorization: Bearer $CRON_SECRET。
 * 触发频率：建议每日一次（`0 3 * * *`）；候选过多时分批处理。
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
  const result = await hardCleanupSoftDeleted();
  const total =
    result.posts + result.works + result.comments + result.collaborations;
  return success(result, `本轮硬删除 ${total} 条软删除内容`);
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
