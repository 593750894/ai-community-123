import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { ReviewVerificationSchema } from "@/lib/organizations/schemas";
import { reviewOrgVerification } from "@/lib/organizations/verification";
import { createRateLimiter } from "@/lib/rate-limit";
import { error, success } from "@/lib/response";

const reviewLimiter = createRateLimiter({
  limit: 100,
  windowMs: 60 * 1000,
  name: "org-verification-review",
});

/** POST /api/admin/organizations/[id]/verification — admin 审核（APPROVE / REJECT + note）。 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();
    reviewLimiter.check(user.id);

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = ReviewVerificationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }
    await reviewOrgVerification({
      organizationId: id,
      adminId: user.id,
      input: parsed.data,
    });
    return success({ ok: true }, "已处理审核");
  } catch (err) {
    return error(err);
  }
}
