import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { ValidationError } from "@/lib/errors";
import { success, created, error } from "@/lib/response";
import { createRateLimiter } from "@/lib/rate-limit";
import { SubmitAppealSchema, APPEAL_STATUSES } from "@/lib/content/schemas";
import { listMyAppeals, submitAppeal } from "@/lib/content/appeals";

const submitAppealLimiter = createRateLimiter({
  limit: 5,
  windowMs: 60 * 60 * 1000,
  name: "content-appeal",
});

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const status =
      statusParam && (APPEAL_STATUSES as readonly string[]).includes(statusParam)
        ? (statusParam as (typeof APPEAL_STATUSES)[number])
        : undefined;
    const page = Number(url.searchParams.get("page") ?? 1) || 1;
    const result = await listMyAppeals(user.id, { status, page });
    return success(result);
  } catch (err) {
    return error(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    await requireActiveUser(user);
    submitAppealLimiter.check(user.id);
    const body = await request.json().catch(() => null);
    const parsed = SubmitAppealSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    const result = await submitAppeal(parsed.data, user.id);
    return created(result, "申诉已提交，请等待审核");
  } catch (err) {
    return error(err);
  }
}
