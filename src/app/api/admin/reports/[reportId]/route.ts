import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import {
  adminClaimReport,
  adminReleaseReport,
  adminResolveReport,
} from "@/lib/reports/actions";
import { getReportById } from "@/lib/reports/queries";
import { ResolveReportSchema } from "@/lib/reports/schemas";

/** Stage 17.1：MOD + ADMIN 都可访问。 */
async function requireModUser() {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "MOD") {
    throw new ForbiddenError();
  }
  return user;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    await requireModUser();
    const { reportId } = await params;
    const report = await getReportById(reportId);
    if (!report) throw new NotFoundError("举报");
    return success(report);
  } catch (err) {
    return error(err);
  }
}

/**
 * PATCH 多入口：
 *   - { action: "claim" }                    认领（PENDING → REVIEWING）
 *   - { action: "release" }                  释放认领（REVIEWING → PENDING）
 *   - { status: "RESOLVED" | "DISMISSED" }   结案（原有行为）
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const actor = await requireModUser();
    const { reportId } = await params;
    const body: unknown = await request.json().catch(() => ({}));
    const action =
      body && typeof body === "object" && "action" in body
        ? (body as { action?: unknown }).action
        : undefined;

    if (action === "claim") {
      await adminClaimReport(reportId, actor.id);
      return success(await getReportById(reportId), "已认领");
    }
    if (action === "release") {
      await adminReleaseReport(reportId, {
        id: actor.id,
        role: actor.role,
      });
      return success(await getReportById(reportId), "已释放");
    }

    const parsed = ResolveReportSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    await adminResolveReport(reportId, parsed.data, actor.id);
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
    const actor = await requireModUser();
    const { reportId } = await params;
    await adminResolveReport(
      reportId,
      { status: "DISMISSED" },
      actor.id,
    );
    return success(null, "已驳回");
  } catch (err) {
    return error(err);
  }
}
