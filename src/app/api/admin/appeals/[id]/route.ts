import { requireAdminApi } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { createRateLimiter } from "@/lib/rate-limit";
import { ReviewAppealSchema } from "@/lib/content/schemas";
import { reviewAppeal } from "@/lib/content/appeals";

const reviewAppealLimiter = createRateLimiter({
  limit: 100,
  windowMs: 60 * 1000,
  name: "content-appeal-review",
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdminApi();
    const { id } = await params;
    reviewAppealLimiter.check(admin.id);
    const body = await request.json().catch(() => null);
    const parsed = ReviewAppealSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    await reviewAppeal(id, parsed.data, admin.id);
    return success(null, parsed.data.decision === "APPROVE" ? "已通过申诉，内容已恢复" : "已驳回申诉");
  } catch (err) {
    return error(err);
  }
}
