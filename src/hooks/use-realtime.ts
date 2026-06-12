"use client";

import { useEffect, useRef } from "react";

import type { RealtimeEvent } from "@/lib/realtime/bus";

/**
 * Stage 12.5：客户端 EventSource 订阅 hook。
 *
 * - 仅在 enabled=true 时建立连接（默认 true）。未登录的页面应传 false 避免 401 死循环。
 * - 自动重连：onerror → 指数退避 1s → 30s 上限；切回前台 (visibilitychange visible)
 *   立即尝试重连并重置退避。
 * - 不在 SSR 环境创建 EventSource（typeof undefined 守卫）。
 * - handler 用 ref 解决「父组件每次渲染都传新函数」导致重连的问题——hook 内只在
 *   enabled 变化时重置连接。
 *
 * 由于事件 envelope 自带 `kind` 字段，调用方在 handler 内 switch (event.kind) 分发即可。
 */

export type RealtimeHandler = (event: RealtimeEvent) => void;

export interface UseRealtimeOptions {
  /** 默认 true；未登录或离线场景请显式传 false 避免无谓的 401 重连。 */
  enabled?: boolean;
}

const EVENT_KINDS: ReadonlyArray<RealtimeEvent["kind"]> = [
  "message.created",
  "message.updated",
  "message.deleted",
  "notification.created",
];

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

export function useRealtime(
  handler: RealtimeHandler,
  options: UseRealtimeOptions = {},
): void {
  const { enabled = true } = options;
  // handler 不参与连接依赖：用 effect 同步 ref，避免 render 期写 ref 触发
  // react-hooks/refs 规则。SSE 是低频事件，下一帧 ref 同步对体验无感知。
  const handlerRef = useRef<RealtimeHandler>(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (typeof window.EventSource === "undefined") return;

    let cancelled = false;
    let source: EventSource | null = null;
    let retryDelayMs = INITIAL_RETRY_MS;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    // 只有在 onopen 真正触发后，下一轮 visibilitychange 才允许把退避计数器重置回 1s。
    // 否则未授权 (401) 用户反复切 tab 会触发约 1 RPS 的 401 风暴。
    let openedOnce = false;

    const clearRetryTimer = () => {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const close = () => {
      if (source) {
        try {
          source.close();
        } catch {
          // ignore
        }
        source = null;
      }
    };

    const connect = () => {
      if (cancelled) return;
      close();

      const es = new EventSource("/api/realtime/stream", {
        withCredentials: true,
      });
      source = es;

      const onTyped = (raw: MessageEvent) => {
        try {
          const parsed = JSON.parse(raw.data) as RealtimeEvent;
          handlerRef.current(parsed);
        } catch {
          // 坏数据忽略——单事件解析失败不应拖垮整个订阅。
        }
      };

      for (const kind of EVENT_KINDS) {
        es.addEventListener(kind, onTyped as EventListener);
      }

      es.onopen = () => {
        // 成功握上连接（HTTP 200）才认为身份有效，重置退避。
        openedOnce = true;
        retryDelayMs = INITIAL_RETRY_MS;
      };

      es.onerror = () => {
        // EventSource 内部会自动尝试重连；但我们想用受控的退避并防止 401 死循环。
        // 401 → readyState 维持 CLOSED；这里统一 close + setTimeout 重连，
        // 直到下次 visibility 切换或 enabled 变化才停止。
        close();
        if (cancelled) return;
        clearRetryTimer();
        retryTimer = setTimeout(connect, retryDelayMs);
        retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_MS);
      };
    };

    connect();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (cancelled) return;
      // 回到前台：仅当之前曾握手成功过、且当前没连上时才立即试 + 重置退避。
      // 从未握手成功（401 / 网络错误） → 沿用现有退避，避免切 tab 把 401 节奏加速到 1s。
      if (!openedOnce) return;
      if (!source || source.readyState === EventSource.CLOSED) {
        retryDelayMs = INITIAL_RETRY_MS;
        clearRetryTimer();
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      clearRetryTimer();
      close();
    };
  }, [enabled]);
}
