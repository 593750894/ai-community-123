import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { inviteMember } from "@/lib/organizations/actions";
import {
  getViewerMembership,
  listOrganizationInvites,
} from "@/lib/organizations/queries";
import { InviteMemberSchema } from "@/lib/organizations/schemas";
import { createRateLimiter } from "@/lib/rate-limit";
import { created, error, success } from "@/lib/response";

const inviteLimiter = createRateLimiter({
  limit: 30,
  windowMs: 60 * 60 * 1000,
  name: "org-invite",
});

/** GET /api/me/organizations/[id]/invites — 邀请列表（仅 OWNER/ADMIN）。 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const m = await getViewerMembership(id, user.id);
    if (!m || (m.role !== "OWNER" && m.role !== "ADMIN")) {
      throw new ForbiddenError("仅管理员可查看邀请列表");
    }
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const valid = ["PENDING", "ACCEPTED", "REJECTED", "CANCELED"];
    const items = await listOrganizationInvites(
      id,
      status && valid.includes(status)
        ? (status as "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED")
        : null,
    );
    return success({ items });
  } catch (err) {
    return error(err);
  }
}

/** POST /api/me/organizations/[id]/invites — 创建邀请。30/h 限流。 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    await requireActiveUser(user);
    inviteLimiter.check(user.id);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = InviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }
    const invite = await inviteMember({
      organizationId: id,
      actorId: user.id,
      input: parsed.data,
    });
    return created(invite, "邀请已发出");
  } catch (err) {
    return error(err);
  }
}
