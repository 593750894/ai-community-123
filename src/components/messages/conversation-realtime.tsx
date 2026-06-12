"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { useRealtimeEvent } from "@/components/providers/realtime-provider";

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
 *
 * Stage 12.5 post-audit (M6 + M7)：
 *  - 改用单一 RealtimeProvider 的 useRealtimeEvent，省掉本组件单开一条 EventSource。
 *  - 增加 unmount 清理 pendingRef，避免切走后仍 router.refresh() 到新路由。
 */
export function ConversationRealtime({
  conversationId,
}: {
  conversationId: string;
}) {
  const router = useRouter();
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handler = useCallback(
    (event: {
      kind:
        | "message.created"
        | "message.updated"
        | "message.deleted";
      conversationId: string;
    }) => {
      if (event.conversationId !== conversationId) return;
      if (pendingRef.current !== null) return;
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null;
        router.refresh();
      }, 150);
    },
    [conversationId, router],
  );

  useRealtimeEvent("message.created", handler);
  useRealtimeEvent("message.updated", handler);
  useRealtimeEvent("message.deleted", handler);

  useEffect(() => {
    return () => {
      if (pendingRef.current) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
    };
  }, []);

  return null;
}
