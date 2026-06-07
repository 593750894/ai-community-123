import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { UpdateGroupMemberRoleSchema } from "@/lib/messages/schemas";
import {
  removeGroupMember,
  updateGroupMemberRole,
} from "@/lib/messages/groups";

export async function PATCH(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ conversationId: string; userId: string }>;
  },
) {
  try {
    const user = await requireAuth();
    const { conversationId, userId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = UpdateGroupMemberRoleSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    await updateGroupMemberRole(user.id, conversationId, userId, parsed.data);
    return success(null, "角色已更新");
  } catch (err) {
    return error(err);
  }
}

export async function DELETE(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ conversationId: string; userId: string }>;
  },
) {
  try {
    const user = await requireAuth();
    const { conversationId, userId } = await params;
    await removeGroupMember(user.id, conversationId, userId);
    return success(null, "成员已移除");
  } catch (err) {
    return error(err);
  }
}
