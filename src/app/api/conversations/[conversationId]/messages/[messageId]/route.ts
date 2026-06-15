import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { EditMessageSchema } from "@/lib/messages/schemas";
import { editMessage, softDeleteMessage } from "@/lib/messages/lifecycle";

/**
 * Stage 12.4：消息编辑 / 撤回入口。
 * - PATCH：发送者本人 15 分钟内可改文本。
 * - DELETE：发送者本人 2 分钟内可撤回；群主 / 管理员可强删低权限成员消息（无窗口）。
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  try {
    const user = await requireAuth();
    await requireActiveUser(user);
    const { messageId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = EditMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    const updated = await editMessage(user.id, messageId, parsed.data);
    return success(updated, "消息已更新");
  } catch (err) {
    return error(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  try {
    const user = await requireAuth();
    const { messageId } = await params;
    await softDeleteMessage(user.id, messageId);
    return success(null, "消息已撤回");
  } catch (err) {
    return error(err);
  }
}
