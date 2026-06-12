"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

import { useRealtime } from "@/hooks/use-realtime";

/**
 * Stage 12.5：/messages 列表页的 realtime 触发器（client-only，无 UI）。
 *
 * 任何 message.* 事件都触发 list refresh：新会话、未读 +1、最后一条预览、撤回 placeholder
 * 都依赖 router.refresh 去 SSR 重算。250ms 合并窗口防止短时间多事件触发多次刷新。
 */
export function ConversationListRealtime() {
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
      if (pendingRef.current !== null) return;
      pendingRef.current = setTimeout(() => {
        pendingRef.current = null;
        router.refresh();
      }, 250);
    },
    [router],
  );

  useRealtime(handler);

  return null;
}
