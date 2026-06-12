"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

import type { RealtimeEvent } from "@/lib/realtime/bus";

/**
 * Stage 12.5 (post-audit M6)：单一 RealtimeProvider 持一条 EventSource，所有用到
 * 实时事件的组件通过 `useRealtimeEvent(kind, handler)` 订阅 —— 把原先的
 * 「每个组件 useRealtime 自己开一条流」改成「全应用共用一条」。
 *
 * 收益：
 *  - 单 tab 1 条 SSE 连接，不再随消费组件数线性增长（之前 NotificationBell +
 *    ConversationRealtime + ConversationListRealtime 同时存在时 → 3 条流，
 *    server 端 subscriber 数翻倍）。
 *  - 401 storm 的影响面缩到 1 条流，配合 use-realtime.ts 里的 openedOnce 闸更稳。
 *  - 取消订阅由 React effect 生命周期统一管理，不会因为路由切换残留 listener。
 *
 * 设计细节：
 *  - Provider 内部维护 subscribers Map<kind, Set<handler>>；publish 时只触发匹配 kind。
 *  - 连接生命周期沿用旧 use-realtime.ts 的策略：1s→30s 指数退避、`onopen` 后才允许
 *    visibility 重置退避、SSR 守卫、cancel/unmount 都清理。
 *  - enabled=false（未登录）时不建立连接 + 内部 Map 仍可挂订阅（这样上层组件 hooks
 *    顺序保持稳定，登录后无需重新 mount）。
 */

export type RealtimeEventKind = RealtimeEvent["kind"];
export type RealtimeHandler<K extends RealtimeEventKind = RealtimeEventKind> = (
  event: Extract<RealtimeEvent, { kind: K }>,
) => void;

// 内部使用的"擦掉类型"的 handler 形态；按 kind 分桶后类型仍然对得上，
// 但 Map 这一层不带泛型，存进去前后都按 RealtimeEvent 看待。
type ErasedHandler = (event: RealtimeEvent) => void;

interface RealtimeContextValue {
  subscribe<K extends RealtimeEventKind>(
    kind: K,
    handler: RealtimeHandler<K>,
  ): () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const EVENT_KINDS: ReadonlyArray<RealtimeEventKind> = [
  "message.created",
  "message.updated",
  "message.deleted",
  "notification.created",
];

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

export interface RealtimeProviderProps {
  /** 未登录 / 离线场景下传 false，避免 401 重连风暴。默认 true。 */
  enabled?: boolean;
  children: ReactNode;
}

export function RealtimeProvider({
  enabled = true,
  children,
}: RealtimeProviderProps) {
  // 订阅注册表：组件挂载即可订阅，不依赖连接是否建立。
  // Map 值为 ErasedHandler —— 同 kind 桶里都接 RealtimeEvent；调用端的 RealtimeHandler<K>
  // 只是公开 API 的语法糖，cast 仅发生在 subscribe 入口处。
  const subsRef = useRef<Map<RealtimeEventKind, Set<ErasedHandler>>>(new Map());

  const subscribe = useCallback(
    <K extends RealtimeEventKind>(kind: K, handler: RealtimeHandler<K>) => {
      const map = subsRef.current;
      let set = map.get(kind);
      if (!set) {
        set = new Set();
        map.set(kind, set);
      }
      const erased = handler as unknown as ErasedHandler;
      set.add(erased);
      return () => {
        const cur = map.get(kind);
        if (!cur) return;
        cur.delete(erased);
        if (cur.size === 0) map.delete(kind);
      };
    },
    [],
  );

  // 连接生命周期：仅 enabled=true 时建立流；enabled 翻转会触发 effect 重跑。
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (typeof window.EventSource === "undefined") return;

    let cancelled = false;
    let source: EventSource | null = null;
    let retryDelayMs = INITIAL_RETRY_MS;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
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

    const dispatch = (event: RealtimeEvent) => {
      const set = subsRef.current.get(event.kind);
      if (!set || set.size === 0) return;
      // 复制一份，订阅者在回调里 unsubscribe 不会影响本次派发。
      for (const handler of Array.from(set)) {
        try {
          handler(event);
        } catch (err) {
          // 单个 handler 抛错不应拖垮其它订阅者。
          // eslint-disable-next-line no-console
          console.warn("[realtime] handler threw", err);
        }
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
          dispatch(parsed);
        } catch {
          // 单事件解析失败忽略
        }
      };

      for (const kind of EVENT_KINDS) {
        es.addEventListener(kind, onTyped as EventListener);
      }

      es.onopen = () => {
        openedOnce = true;
        retryDelayMs = INITIAL_RETRY_MS;
      };

      es.onerror = () => {
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
      // 之前没握手成功过 → 不重置退避，避免 401 用户切 tab 拉高重连频率。
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

  const value = useMemo<RealtimeContextValue>(() => ({ subscribe }), [subscribe]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * 订阅单一 kind 的事件。handler 用 ref 解耦，父组件每次渲染传新函数也不会重订阅。
 * 未挂在 RealtimeProvider 下时静默 no-op（避免 storybook / 测试环境报错）。
 */
export function useRealtimeEvent<K extends RealtimeEventKind>(
  kind: K,
  handler: RealtimeHandler<K>,
): void {
  const ctx = useContext(RealtimeContext);
  const handlerRef = useRef<RealtimeHandler<K>>(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(kind, (ev) => {
      handlerRef.current(ev);
    });
  }, [ctx, kind]);
}
