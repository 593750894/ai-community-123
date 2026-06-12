/**
 * Stage 12.5：实时事件发布层。
 *
 * 业务侧只调用这里的 publishXxx，不直接 touch bus.ts。所有方法都是 fire-and-forget；
 * 任何错误吞掉并 console.warn，不影响主流程（消息已经写入 DB，事件丢一条也只是
 * 客户端晚 60s 通过轮询拉到——绝不可让 realtime 抖动反过来打挂业务写入）。
 *
 * 一致性约束：必须在 DB 事务提交后调用 publishMessageCreated/Updated/Deleted。
 * 否则订阅者收到通知后 GET 会查不到最新数据。调用点已遵循此约束。
 */

import { prisma } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma/client";
import type { MessageType } from "@/lib/messages/queries";
import {
  publishToUser,
  publishToUsers,
  type RealtimeEvent,
} from "@/lib/realtime/bus";

/** 拉取会话所有参与者 id；缓存粒度太小不值得，每次直接走 DB 即可。 */
async function conversationParticipantIds(
  conversationId: string,
): Promise<string[]> {
  const rows = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/**
 * 新消息（任意类型，TEXT/IMAGE/FILE/SYSTEM）。
 * 广播给所有参与者；含发送者本人——TA 的其它 tab 也需要更新。
 *
 * Stage 12.5 修：调用方可传入 `participantIds` 快照（在消息写入事务前已拿到的）
 * 来跳过这里的 DB 查询。这样能避免「写消息 → 成员变更 → publish 查到新成员集合」
 * 的 race：成员被踢后仍能收到自己在群里时的消息事件，而新加入的成员不会收到
 * 加入前的事件。同时省一次 DB 往返。
 */
export async function publishMessageCreated(args: {
  conversationId: string;
  messageId: string;
  senderId: string;
  type: MessageType;
  participantIds?: ReadonlyArray<string>;
}): Promise<void> {
  try {
    const ids = args.participantIds
      ? Array.from(args.participantIds)
      : await conversationParticipantIds(args.conversationId);
    if (ids.length === 0) return;
    const event: RealtimeEvent = {
      kind: "message.created",
      conversationId: args.conversationId,
      messageId: args.messageId,
      senderId: args.senderId,
      messageType: args.type,
      at: new Date().toISOString(),
    };
    publishToUsers(ids, event);
  } catch (err) {
    console.warn("[realtime] publishMessageCreated", err);
  }
}

/** 消息内容更新（edit）。仅 conversationId/messageId 即可让客户端重拉。 */
export async function publishMessageUpdated(args: {
  conversationId: string;
  messageId: string;
  participantIds?: ReadonlyArray<string>;
}): Promise<void> {
  try {
    const ids = args.participantIds
      ? Array.from(args.participantIds)
      : await conversationParticipantIds(args.conversationId);
    if (ids.length === 0) return;
    publishToUsers(ids, {
      kind: "message.updated",
      conversationId: args.conversationId,
      messageId: args.messageId,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[realtime] publishMessageUpdated", err);
  }
}

/** 消息撤回（soft delete）。 */
export async function publishMessageDeleted(args: {
  conversationId: string;
  messageId: string;
  participantIds?: ReadonlyArray<string>;
}): Promise<void> {
  try {
    const ids = args.participantIds
      ? Array.from(args.participantIds)
      : await conversationParticipantIds(args.conversationId);
    if (ids.length === 0) return;
    publishToUsers(ids, {
      kind: "message.deleted",
      conversationId: args.conversationId,
      messageId: args.messageId,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[realtime] publishMessageDeleted", err);
  }
}

/**
 * 通知创建：单收件人推送。
 * 调用方在 notification.create 之后立即同步触发，无需 await（同步发布，无 DB 二次查询）。
 */
export function publishNotificationCreated(args: {
  recipientId: string;
  notificationId: string;
  type: NotificationType;
}): void {
  try {
    publishToUser(args.recipientId, {
      kind: "notification.created",
      notificationId: args.notificationId,
      notificationType: args.type,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[realtime] publishNotificationCreated", err);
  }
}
