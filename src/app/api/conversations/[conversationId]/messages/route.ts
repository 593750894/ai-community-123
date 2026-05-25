import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { success, created, error } from "@/lib/response";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { z } from "zod";

const SendMessageBodySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "消息不能为空")
    .max(4000, "消息最多 4000 个字符"),
});

async function getConversationAndVerify(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: { select: { userId: true } },
    },
  });

  if (!conversation) throw new NotFoundError("会话");

  const isParticipant = conversation.participants.some(
    (p) => p.userId === userId,
  );
  if (!isParticipant) throw new ForbiddenError("无权访问此会话");

  return conversation;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = await requireAuth();
    const { conversationId } = await params;
    const url = new URL(request.url);
    const { page, pageSize, skip } = parsePagination(url);

    await getConversationAndVerify(conversationId, user.id);

    const where = { conversationId };

    const [items, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: {
          sender: {
            select: { id: true, username: true, name: true, avatar: true },
          },
        },
      }),
      prisma.message.count({ where }),
    ]);

    return success(paginatedResponse(items, total, page, pageSize));
  } catch (err) {
    return error(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const user = await requireAuth();
    const { conversationId } = await params;

    const body = await request.json();
    const parsed = SendMessageBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    await getConversationAndVerify(conversationId, user.id);

    const now = new Date();

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          senderId: user.id,
          content: parsed.data.content,
        },
        include: {
          sender: {
            select: { id: true, username: true, name: true, avatar: true },
          },
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      }),
    ]);

    return created(message, "发送成功");
  } catch (err) {
    return error(err);
  }
}
