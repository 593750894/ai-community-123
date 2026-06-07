import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { removeMember, updateMemberRole } from "@/lib/organizations/actions";
import {
  INVITE_ASSIGNABLE_ROLES,
  type InviteAssignableRole,
} from "@/lib/organizations/schemas";
import { error, success } from "@/lib/response";

/** PATCH /api/me/organizations/[id]/members/[userId] — 改成员角色（仅 OWNER）。 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const user = await requireAuth();
    const { id, userId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { role?: string };
    if (!body?.role || !(INVITE_ASSIGNABLE_ROLES as readonly string[]).includes(body.role)) {
      throw new ValidationError("role 仅可为 MEMBER 或 ADMIN");
    }
    await updateMemberRole({
      organizationId: id,
      actorId: user.id,
      targetUserId: userId,
      role: body.role as InviteAssignableRole,
    });
    return success({ ok: true }, "角色已更新");
  } catch (err) {
    return error(err);
  }
}

/** DELETE /api/me/organizations/[id]/members/[userId] — 移除成员。 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const user = await requireAuth();
    const { id, userId } = await context.params;
    await removeMember({
      organizationId: id,
      actorId: user.id,
      targetUserId: userId,
    });
    return success({ ok: true }, "已移除成员");
  } catch (err) {
    return error(err);
  }
}
