import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { getViewerMembership } from "@/lib/organizations/queries";
import { SubmitVerificationSchema } from "@/lib/organizations/schemas";
import {
  cancelOrgVerification,
  getOrgVerification,
  submitOrgVerification,
} from "@/lib/organizations/verification";
import { createRateLimiter } from "@/lib/rate-limit";
import { created, error, success } from "@/lib/response";

const submitLimiter = createRateLimiter({
  limit: 5,
  windowMs: 60 * 60 * 1000,
  name: "org-verification-submit",
});

/** GET /api/me/organizations/[id]/verification — 当前认证状态（仅 OWNER/ADMIN）。 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const m = await getViewerMembership(id, user.id);
    if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) {
      throw new ForbiddenError("仅 OWNER / ADMIN 可查看认证详情");
    }
    const v = await getOrgVerification(id);
    if (!v) throw new NotFoundError("企业");
    return success(v);
  } catch (err) {
    return error(err);
  }
}

/** POST /api/me/organizations/[id]/verification — 提交 / 重新提交。 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    await requireActiveUser(user);
    submitLimiter.check(user.id);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = SubmitVerificationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }
    await submitOrgVerification({
      organizationId: id,
      actorId: user.id,
      input: parsed.data,
    });
    return created({ ok: true }, "已提交，等待审核");
  } catch (err) {
    return error(err);
  }
}

/** DELETE /api/me/organizations/[id]/verification — 撤回 PENDING 申请。 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    await cancelOrgVerification({ organizationId: id, actorId: user.id });
    return success({ ok: true }, "已撤回认证申请");
  } catch (err) {
    return error(err);
  }
}
