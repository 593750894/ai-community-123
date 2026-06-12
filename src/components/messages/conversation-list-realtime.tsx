"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { useRealtimeEvent } from "@/components/providers/realtime-provider";

/**
 * Stage 12.5：/messages 列表页的 realtime 触发器（client-only，无 UI）。
 *
 * 任何 message.* 事件都触发 list refresh：新会话、未读 +1、最后一条预览、撤回 placeholder
 * 都依赖 router.refresh 去 SSR 重算。250ms 合并窗口防止短时间多事件触发多次刷新。
 *
 * Stage 12.5 post-audit (M6 + M7)：迁到单一 RealtimeProvider + unmount 清理待处理刷新。
 */
export function ConversationListRealtime() {
  const router = useRouter();
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handler = useCallback(() => {
    if (pendingRef.current !== null) return;
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null;
      router.refresh();
    }, 250);
  }, [router]);

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
