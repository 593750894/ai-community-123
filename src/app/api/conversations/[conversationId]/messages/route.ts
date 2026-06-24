import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { success, created, error } from "@/lib/response";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { notifyMessage } from "@/lib/notifications/emit";
import {
  buildMessagePreview,
  inferMessageType,
} from "@/lib/messages/preview";
import { parseMentions } from "@/lib/messages/lifecycle";
import { publishMessageCreated } from "@/lib/realtime/events";
import { assertNotBlocked } from "@/lib/content/blocked-words";
import {
  MESSAGE_ATTACHMENT_MAX_COUNT,
  MESSAGE_CONTENT_MAX,
  MessageAttachmentSchema,
} from "@/lib/messages/schemas";
import { z } from "zod";

const SendMessageBodySchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(MESSAGE_CONTENT_MAX, `消息最多 ${MESSAGE_CONTENT_MAX} 个字符`)
      .default(""),
    attachments: z
      .array(MessageAttachmentSchema)
      .max(
        MESSAGE_ATTACHMENT_MAX_COUNT,
        `单条消息最多 ${MESSAGE_ATTACHMENT_MAX_COUNT} 个附件`,
      )
      .default([]),
  })
  .superRefine((val, ctx) => {
    if (val.content.length === 0 && val.attachments.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "消息或附件至少需要一项",
        path: ["content"],
      });
    }
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
    await requireActiveUser(user);
    const { conversationId } = await params;

    const body = await request.json();
    const parsed = SendMessageBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }

    const conversation = await getConversationAndVerify(conversationId, user.id);
    // Stage 12.5 修：抓取消息写入「那一刻」的参与者快照，喂给 publishMessageCreated，
    // 避免随后成员变更（加入/退出）让 realtime 推送漂移到新集合。
    const participantIds = conversation.participants.map((p) => p.userId);

    const { content, attachments } = parsed.data;
    const type = inferMessageType(attachments);
    const preview = buildMessagePreview(content, attachments);

    // Stage 17.3：关键词黑名单。空文本（纯附件消息）跳过。
    if (content && content.length > 0) {
      await assertNotBlocked(
        {
          scope: "MESSAGE",
          actorId: user.id,
          source: `message:api-send:conversationId=${conversationId}`,
        },
        content,
      );
    }

    const now = new Date();

    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          senderId: user.id,
          content,
          type,
          attachments:
            attachments.length > 0
              ? (attachments as unknown as object)
              : undefined,
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

    // Stage 12.5：先广播实时事件（覆盖所有 SSE 订阅者，不绕 notification 偏好）。
    await publishMessageCreated({
      conversationId,
      messageId: message.id,
      senderId: user.id,
      type,
      participantIds,
    });

    await notifyMessage({
      conversationId,
      messageId: message.id,
      actorId: user.id,
      preview,
      mentions: parseMentions(content),
    });

    return created(message, "发送成功");
  } catch (err) {
    return error(err);
  }
}
