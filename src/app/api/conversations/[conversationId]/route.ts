import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { success, error } from "@/lib/response";

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
