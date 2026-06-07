import { requireAuth } from "@/lib/auth/guard";
import { cancelInvite } from "@/lib/organizations/actions";
import { error, success } from "@/lib/response";

/** DELETE /api/me/organizations/invites/[inviteId] — 邀请人 / 管理员撤销 PENDING 邀请。 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ inviteId: string }> },
) {
  try {
    const user = await requireAuth();
    const { inviteId } = await context.params;
    await cancelInvite({ inviteId, actorId: user.id });
    return success({ ok: true }, "邀请已撤销");
  } catch (err) {
    return error(err);
  }
}
