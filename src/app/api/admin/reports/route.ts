import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { listReports } from "@/lib/reports/queries";
import { ListReportsQuerySchema } from "@/lib/reports/schemas";

/**
 * GET /api/admin/reports?status=PENDING&targetType=POST&page=1&pageSize=20
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();
    const url = new URL(request.url);
    const parsed = ListReportsQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      targetType: url.searchParams.get("targetType") ?? undefined,
    });
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    const { page, pageSize } = parsePagination(url);
    const { items, total } = await listReports({
      status: parsed.data.status,
      targetType: parsed.data.targetType,
      page,
      pageSize,
    });
    return success(paginatedResponse(items, total, page, pageSize));
  } catch (err) {
    return error(err);
  }
}
