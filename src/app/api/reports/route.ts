import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { created, error } from "@/lib/response";
import { CreateReportSchema } from "@/lib/reports/schemas";
import { createReport } from "@/lib/reports/actions";

/**
 * POST /api/reports
 * Body: { targetType, targetId, reason, description? }
 * - 401 未登录
 * - 400 校验失败
 * - 403 自举报
 * - 404 目标不存在
 * - 409 重复举报（已有未结）
 * - 429 频率超限（1h > 20）
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const parsed = CreateReportSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    const report = await createReport(parsed.data, user.id);
    return created(report, "举报已提交，感谢你帮助维护社区");
  } catch (err) {
    return error(err);
  }
}
