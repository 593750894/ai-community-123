/**
 * Stage 12.5：进程内实时事件总线（in-memory pub/sub）。
 *
 * 设计取舍：
 * - MVP 默认单实例 Next.js Node runtime，所有 SSE 连接订阅到同一进程的 Map。
 * - 多实例（Vercel serverless / k8s pods）时此实现不足以跨进程广播——届时
 *   改用 Redis pub/sub 或 Postgres LISTEN/NOTIFY，只需替换 bus.ts 实现，
 *   events.ts / SSE 路由 / 客户端 hook 全部无需变更。
 * - 不持久化：订阅者断开后不补送（SSE EventSource 自带 Last-Event-ID，但本期
 *   只用作"红点 + 强制刷新"提示，不送完整 payload，丢一条无害——下一次 router.refresh
 *   会重新拉到完整数据）。
 *
 * dev hot reload 兼容：把 subscribers map 挂到 globalThis，避免 Turbopack 重新
 * 实例化 module 导致老订阅丢失但 SSE writer 仍在写关闭的 controller。
 */

import type { NotificationType } from "@/generated/prisma/client";
import type { MessageType } from "@/lib/messages/queries";

/** 通用 envelope：所有事件都带 kind 字段，UI 分发用。 */
export type RealtimeEvent =
  | {
      kind: "message.created";
      conversationId: string;
      messageId: string;
      senderId: string;
      messageType: MessageType;
      at: string;
    }
  | {
      kind: "message.updated";
      conversationId: string;
      messageId: string;
      at: string;
    }
  | {
      kind: "message.deleted";
      conversationId: string;
      messageId: string;
      at: string;
    }
  | {
      kind: "notification.created";
      notificationId: string;
      notificationType: NotificationType;
      at: string;
    };

export type RealtimeSubscriber = (event: RealtimeEvent) => void;

/**
 * 单例 subscribers map：userId → Set<send fn>。
 * 同一用户允许多个并发订阅（多 tab / 多设备）。
 */
type SubscriberMap = Map<string, Set<RealtimeSubscriber>>;

const G = globalThis as unknown as {
  __aiCommunityRealtimeSubs?: SubscriberMap;
};
const subscribers: SubscriberMap =
  G.__aiCommunityRealtimeSubs ?? (G.__aiCommunityRealtimeSubs = new Map());

/**
 * Stage 12.5 audit M4：单用户并发 SSE 连接上限。
 *
 * 上限设到 8：覆盖正常用户开 ~3-4 个 tab + 自动重连 / 移动端切换的余量；超过这个数
 * 几乎可以认为是登录后的脚本式 DoS。超额时 subscribe 返回 null，由路由层回 429
 * 而不是开流——已认证 DoS 路径就此封死。
 *
 * 经 useRealtimeEvent / RealtimeProvider 重构后单 tab 只占 1 个 subscriber，
 * 用户即便挂 4-5 个 tab 也都进不到这个上限。
 */
export const MAX_SUBSCRIBERS_PER_USER = 8;

/**
 * 订阅 userId 的所有事件。
 * 返回 unsubscribe 函数；SSE endpoint 在 stream 关闭时必须调用。
 * 当该用户的并发连接已达上限时，返回 null —— 调用方应拒绝继续打开流。
 */
export function subscribe(
  userId: string,
  send: RealtimeSubscriber,
): (() => void) | null {
  let set = subscribers.get(userId);
  if (set && set.size >= MAX_SUBSCRIBERS_PER_USER) {
    return null;
  }
  if (!set) {
    set = new Set();
    subscribers.set(userId, set);
  }
  set.add(send);
  return () => {
    const cur = subscribers.get(userId);
    if (!cur) return;
    cur.delete(send);
    if (cur.size === 0) subscribers.delete(userId);
  };
}

/** 向单个用户广播事件。subscriber 抛错时移除并继续。 */
export function publishToUser(userId: string, event: RealtimeEvent): void {
  const set = subscribers.get(userId);
  if (!set || set.size === 0) return;
  // 复制一份避免 send 内部调 unsubscribe 时 Set 被并发修改。
  for (const send of Array.from(set)) {
    try {
      send(event);
    } catch (err) {
      // 单个 subscriber 失败不影响其他订阅者；从 set 里清掉。
      set.delete(send);
      console.warn("[realtime] subscriber threw, dropping", err);
    }
  }
  if (set.size === 0) subscribers.delete(userId);
}

/** 批量广播。null/undefined/空数组都安全跳过。 */
export function publishToUsers(
  userIds: ReadonlyArray<string>,
  event: RealtimeEvent,
): void {
  if (!userIds || userIds.length === 0) return;
  // 去重：群聊里同一用户不会出现两次，但 caller 万一传重复也别多发。
  const uniq = new Set(userIds);
  for (const id of uniq) publishToUser(id, event);
}

/** 调试 / 健康检查：当前订阅者总数（用户维度）。 */
export function subscriberStats(): { users: number; connections: number } {
  let connections = 0;
  for (const set of subscribers.values()) connections += set.size;
  return { users: subscribers.size, connections };
}

/** 单用户当前并发订阅数。SSE 路由用它做 429 precheck。 */
export function subscriberCount(userId: string): number {
  return subscribers.get(userId)?.size ?? 0;
}
