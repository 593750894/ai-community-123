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
import { notifyMessage } from "@/lib/notifications/emit";

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

  const parsed = SendMessageSchema.safeParse({
    conversationId: formData.get("conversationId"),
    content: formData.get("content"),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: flattenZodError(parsed.error) };
  }

  const { conversationId, content } = parsed.data;

  // 鉴权：必须是会话参与者
  const membership = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.userId,
      },
    },
    select: { conversationId: true },
  });
  if (!membership) {
    return { ok: false, message: "你不是该会话的参与者" };
  }

  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId: session.userId,
        content,
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

  await notifyMessage({
    conversationId,
    messageId: message.id,
    actorId: session.userId,
    preview: content,
  });

  return {
    ok: true,
    resetKey: (prev?.resetKey ?? 0) + 1,
  };
}
