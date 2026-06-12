"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import {
  SendMessageSchema,
  StartConversationSchema,
} from "@/lib/messages/schemas";
import { findDirectConversation } from "@/lib/messages/queries";
import { buildMessagePreview, inferMessageType } from "@/lib/messages/preview";
import { parseMentions } from "@/lib/messages/lifecycle";
import { notifyMessage } from "@/lib/notifications/emit";
import { publishMessageCreated } from "@/lib/realtime/events";

export type SendMessageFormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** 成功后用于清空 textarea。 */
  resetKey?: number;
};

function flattenZodError(
  error: import("zod").ZodError,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!result[key]) result[key] = [];
    result[key].push(issue.message);
  }
  return result;
}

/**
 * 找到或创建当前用户与 targetUserId 之间的 1:1 会话，然后跳转到详情页。
 *
 * 「同一对人只能有一个会话」的判定：
 * 找一个 participants 数恰好为 2，且同时包含这两个 userId 的 Conversation。
 */
export async function startConversationAction(
  formData: FormData,
): Promise<void> {
  const session = await getSession();
  const parsedTarget = StartConversationSchema.safeParse({
    targetUserId: formData.get("targetUserId"),
  });

  if (!parsedTarget.success) return;
  const { targetUserId } = parsedTarget.data;

  if (!session) {
    redirect(
      `/auth/login?next=${encodeURIComponent(`/profile/${targetUserId}`)}`,
    );
  }
  if (session.userId === targetUserId) {
    // 不允许跟自己发起私信
    redirect(`/profile/${targetUserId}`);
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!target) {
    redirect("/messages");
  }

  // 找已有 1v1 会话（isGroup=false + 参与者数 = 2）
  const existing = await findDirectConversation(session.userId, targetUserId);

  let conversationId: string;
  if (existing) {
    conversationId = existing.id;
  } else {
    const created = await prisma.conversation.create({
      data: {
        isGroup: false,
        memberLimit: 2,
        participants: {
          create: [
            { userId: session.userId },
            { userId: targetUserId },
          ],
        },
      },
      select: { id: true },
    });
    conversationId = created.id;
  }

  revalidatePath("/messages");
  redirect(`/messages/${conversationId}`);
}

/**
 * 在当前会话中发送一条文字消息。
 * MVP 阶段不做 WebSocket，前端通过 revalidatePath 重新读取消息列表。
 */
export async function sendMessageAction(
  prev: SendMessageFormState | undefined,
  formData: FormData,
): Promise<SendMessageFormState> {
  const session = await getSession();
  if (!session) {
    return { ok: false, message: "请先登录后再发送消息" };
  }

  // 附件以 JSON 字符串形式藏在 formData.attachments；空字符串视作 []。
  const rawAttachments = formData.get("attachments");
  let attachments: unknown = [];
  if (typeof rawAttachments === "string" && rawAttachments.length > 0) {
    try {
      attachments = JSON.parse(rawAttachments);
    } catch {
      return { ok: false, message: "附件数据无法解析" };
    }
  }

  const parsed = SendMessageSchema.safeParse({
    conversationId: formData.get("conversationId"),
    content: formData.get("content") ?? "",
    attachments,
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodError(parsed.error) };
  }

  const { conversationId, content, attachments: parsedAttachments } =
    parsed.data;
  const type = inferMessageType(parsedAttachments);
  const preview = buildMessagePreview(content, parsedAttachments);

  // 鉴权 + 抓取参与者快照（Stage 12.5 M3 修）：一次查询既校验 viewer 是成员，
  // 又拿到「此刻」的参与者 ID 集合喂给 publishMessageCreated，避免之后成员变更
  // 导致 realtime 推送漂移到新集合。
  const allParticipants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  if (!allParticipants.some((p) => p.userId === session.userId)) {
    return { ok: false, message: "你不是该会话的参与者" };
  }
  const participantIds = allParticipants.map((p) => p.userId);

  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId: session.userId,
        content,
        type,
        attachments:
          parsedAttachments.length > 0
            ? (parsedAttachments as unknown as object)
            : undefined,
      },
      select: { id: true },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    }),
    // 发送者本人已读
    prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.userId,
        },
      },
      data: { lastReadAt: now },
    }),
  ]);

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");

  // Stage 12.5：先发实时事件，让对方 SSE 流立刻拉到（不依赖通知后才推送）；
  // notifyMessage 内部会再触发 notification.created 事件给 Bell badge。
  await publishMessageCreated({
    conversationId,
    messageId: message.id,
    senderId: session.userId,
    type,
    participantIds,
  });

  await notifyMessage({
    conversationId,
    messageId: message.id,
    actorId: session.userId,
    preview,
    mentions: parseMentions(content),
  });

  return {
    ok: true,
    resetKey: (prev?.resetKey ?? 0) + 1,
  };
}
