import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { MuteConversationSchema } from "@/lib/messages/schemas";
import { muteConversation } from "@/lib/messages/lifecycle";

/**
 * Stage 12.4：会话免打扰设置。
 * PUT body: { hours: number } —— hours=0 取消；最多 30 天。
 * 不区分 1v1 / 群聊；都按 per-participant mutedUntil 推时间。
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = await requireAuth();
    const { conversationId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = MuteConversationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    const result = await muteConversation(
      user.id,
      conversationId,
      parsed.data.hours,
    );
    return success(result, parsed.data.hours === 0 ? "已取消免打扰" : "已开启免打扰");
  } catch (err) {
    return error(err);
  }
}
