"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

import { useRealtime } from "@/hooks/use-realtime";

/**
 * Stage 12.5：会话详情页的 realtime hook 触发器。
 *
 * 渲染为 null（无 UI），挂在 server component 里只是为了在客户端注册 SSE 订阅。
 * 收到 message.created/updated/deleted 且 conversationId 匹配时，调用 router.refresh()
 * 让 SSR 路由重新拉数据；触发频次通过 150ms 合并窗口去抖，群聊 burst 也只刷一次。
 *
 * 为什么用 router.refresh 而非客户端 patch state：
 *  - 详情页消息列表 + 参与者角色 + viewerRole + mute 等都在 server component 算好，
 *    增量 patch 容易漏 SYSTEM 消息 / 撤回 placeholder / 编辑高亮等细节；
 *  - router.refresh 走 RSC 增量补丁，开销不大且能保证视图与 DB 一致。
 */
export function ConversationRealtime({
  conversationId,
}: {
  conversationId: string;
}) {
  const router = useRouter();
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handler = useCallback(
    (event: Parameters<Parameters<typeof useRealtime>[0]>[0]) => {
      if (
        event.kind !== "message.created" &&
        event.kind !== "message.updated" &&
        event.kind !== "message.deleted"
      ) {
        return;
      }
      if (event.conversationId !== conversationId) return;

      // 已经有一个待刷新的 timeout —— 合并到那一次。
      if (pendingRef.current !== null) return;
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null;
        router.refresh();
      }, 150);
    },
    [conversationId, router],
  );

  useRealtime(handler);

  return null;
}
