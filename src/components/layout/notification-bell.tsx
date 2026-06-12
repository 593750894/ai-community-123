"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useRealtimeEvent } from "@/components/providers/realtime-provider";
import { cn } from "@/lib/utils";

interface UnreadCountResponse {
  success: boolean;
  data?: { count: number };
}

const POLL_INTERVAL_MS = 60_000;

interface NotificationBellProps {
  isLoggedIn: boolean;
}

/**
 * 顶部 Bell：每 60s 轮询 /api/notifications/unread-count 作为兜底；
 * Stage 12.5：同时订阅 SSE notification.created 事件，立刻 fetch 一次 count（不直接
 * +1 是为了反映服务端去重 / preference 过滤后的真实未读数，比客户端臆测更准）。
 *
 * 未登录时仅显示一个图标按钮，点击跳登录页。
 */
export function NotificationBell({ isLoggedIn }: NotificationBellProps) {
  const [count, setCount] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<AbortController | null>(null);
  // Stage 12.5 (post-audit M8) Bell debounce：群里短时间 N 条消息会触发 N 次 notification.created
  // 事件，原实现每条都 fetchCount() —— 200ms trailing debounce 折叠成一次。
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCount = useCallback(async () => {
    if (!isLoggedIn) return;
    inflightRef.current?.abort();
    const ctrl = new AbortController();
    inflightRef.current = ctrl;
    try {
      const res = await fetch("/api/notifications/unread-count", {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) return;
      const json = (await res.json()) as UnreadCountResponse;
      if (json.success && json.data) {
        setCount(json.data.count);
      }
    } catch {
      // ignore — 轮询失败下一轮再试
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchCount();

    function schedule() {
      timerRef.current = setTimeout(async () => {
        await fetchCount();
        schedule();
      }, POLL_INTERVAL_MS);
    }
    schedule();

    function onVisibility() {
      if (document.visibilityState === "visible") {
        fetchCount();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      inflightRef.current?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isLoggedIn, fetchCount]);

  // Stage 12.5：SSE 事件触发即时刷新（替代 60s 等待）。Provider 在未登录时不连接，
  // 这里仍按 isLoggedIn 守一道保险（防 SSR 阶段触发或日志噪音）。
  useRealtimeEvent("notification.created", () => {
    if (!isLoggedIn) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void fetchCount();
    }, 200);
  });

  const display = count > 99 ? "99+" : String(count);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      nativeButton={false}
      aria-label={count > 0 ? `通知（${count} 条未读）` : "通知"}
      className="relative hidden sm:inline-flex"
      render={
        <Link href={isLoggedIn ? "/notifications" : "/auth/login?next=/notifications"} />
      }
    >
      <Bell className="size-4" />
      {isLoggedIn && count > 0 && (
        <span
          className={cn(
            "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground shadow-[0_0_10px_-1px_rgba(56,189,248,0.6)]",
          )}
        >
          {display}
        </span>
      )}
    </Button>
  );
}
