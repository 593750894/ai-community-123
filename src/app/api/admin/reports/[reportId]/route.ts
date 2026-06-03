import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import {
  adminResolveReport,
} from "@/lib/reports/actions";
import { getReportById } from "@/lib/reports/queries";
import { ResolveReportSchema } from "@/lib/reports/schemas";

async function requireAdminUser() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new ForbiddenError();
  return user;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    await requireAdminUser();
    const { reportId } = await params;
    const report = await getReportById(reportId);
    if (!report) throw new NotFoundError("举报");
    return success(report);
  } catch (err) {
    return error(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const admin = await requireAdminUser();
    const { reportId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = ResolveReportSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    await adminResolveReport(reportId, parsed.data, admin.id);
    const updated = await getReportById(reportId);
    return success(updated, "处理成功");
  } catch (err) {
    return error(err);
  }
}

/** 等价于 PATCH { status: 'DISMISSED' }，便于纯键盘工作流。 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const admin = await requireAdminUser();
    const { reportId } = await params;
    await adminResolveReport(
      reportId,
      { status: "DISMISSED" },
      admin.id,
    );
    return success(null, "已驳回");
  } catch (err) {
    return error(err);
  }
}
