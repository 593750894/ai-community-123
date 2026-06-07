import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { createOrganization } from "@/lib/organizations/actions";
import { listMyOrganizations } from "@/lib/organizations/queries";
import { CreateOrganizationSchema } from "@/lib/organizations/schemas";
import { createRateLimiter } from "@/lib/rate-limit";
import { created, error, success } from "@/lib/response";

const createLimiter = createRateLimiter({
  limit: 5,
  windowMs: 60 * 60 * 1000,
  name: "create-organization",
});

/** GET /api/me/organizations — 我参与的所有企业（按 createdAt 倒序）。 */
export async function GET() {
  try {
    const user = await requireAuth();
    const items = await listMyOrganizations(user.id);
    return success({ items });
  } catch (err) {
    return error(err);
  }
}

/** POST /api/me/organizations — 创建企业（自动成为 OWNER）。5/h 限流。 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    createLimiter.check(user.id);
    const body = await request.json().catch(() => ({}));
    const parsed = CreateOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }
    const org = await createOrganization({ ownerId: user.id, input: parsed.data });
    return created(org, "企业已创建");
  } catch (err) {
    return error(err);
  }
}
