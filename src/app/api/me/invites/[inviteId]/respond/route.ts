import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { respondToInvite } from "@/lib/organizations/actions";
import { RespondInviteSchema } from "@/lib/organizations/schemas";
import { error, success } from "@/lib/response";

/** POST /api/me/invites/[inviteId]/respond — { action: "accept" | "reject" } */
export async function POST(
  request: Request,
  context: { params: Promise<{ inviteId: string }> },
) {
  try {
    const user = await requireAuth();
    const { inviteId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = RespondInviteSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败");
    }
    await respondToInvite({
      inviteId,
      userId: user.id,
      accept: parsed.data.action === "accept",
    });
    return success({ ok: true }, parsed.data.action === "accept" ? "已加入企业" : "已拒绝邀请");
  } catch (err) {
    return error(err);
  }
}
