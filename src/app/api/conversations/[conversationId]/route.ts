import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { UpdateGroupConversationSchema } from "@/lib/messages/schemas";
import {
  deleteGroupConversation,
  updateGroupConversation,
} from "@/lib/messages/groups";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = await requireAuth();
    const { conversationId } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, name: true, avatar: true },
            },
          },
        },
      },
    });

    if (!conversation) throw new NotFoundError("会话");

    const isParticipant = conversation.participants.some(
      (p) => p.userId === user.id,
    );
    if (!isParticipant) throw new ForbiddenError("无权查看此会话");

    return success(conversation);
  } catch (err) {
    return error(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = await requireAuth();
    const { conversationId } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = UpdateGroupConversationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    await updateGroupConversation(user.id, conversationId, parsed.data);
    return success(null, "群聊信息已更新");
  } catch (err) {
    return error(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = await requireAuth();
    const { conversationId } = await params;
    await deleteGroupConversation(user.id, conversationId);
    return success(null, "群聊已解散");
  } catch (err) {
    return error(err);
  }
}
