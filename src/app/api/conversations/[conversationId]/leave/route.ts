import { requireAuth } from "@/lib/auth/guard";
import { success, error } from "@/lib/response";
import { leaveGroupConversation } from "@/lib/messages/groups";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = await requireAuth();
    const { conversationId } = await params;
    await leaveGroupConversation(user.id, conversationId);
    return success(null, "已退出群聊");
  } catch (err) {
    return error(err);
  }
}
