"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Bookmark, Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  togglePostBookmark,
  togglePostLike,
  toggleWorkBookmark,
  toggleWorkLike,
  type InteractionResult,
} from "@/lib/interactions/actions";

type Target =
  | { kind: "post"; id: string }
  | { kind: "work"; id: string };

type Size = "sm" | "md";

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function loginHref(target: Target): string {
  const next =
    target.kind === "post"
      ? `/post/${target.id}`
      : `/showcase/${target.id}`;
  return `/auth/login?next=${encodeURIComponent(next)}`;
}

/**
 * 通用 like 按钮：未登录点击会跳到登录页；已登录走 server action toggle。
 * 使用 useOptimistic + useTransition：点击瞬间切换 UI，请求完再用服务端真值校正。
 */
export function LikeButton({
  target,
  initialActive,
  initialCount,
  signedIn,
  size = "sm",
  variant = "subtle",
}: {
  target: Target;
  initialActive: boolean;
  initialCount: number;
  signedIn: boolean;
  size?: Size;
  variant?: "subtle" | "solid";
}) {
  const router = useRouter();
  const [serverState, setServerState] = useState({
    active: initialActive,
    count: Math.max(0, initialCount),
  });
  const [optimistic, addOptimistic] = useOptimistic(
    serverState,
    (
      state: { active: boolean; count: number },
      next: { active: boolean; count: number },
    ) => next,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push(loginHref(target));
      return;
    }
    if (pending) return;
    const nextActive = !optimistic.active;
    const nextCount = Math.max(0, optimistic.count + (nextActive ? 1 : -1));
    setError(null);
    startTransition(async () => {
      addOptimistic({ active: nextActive, count: nextCount });
      const result: InteractionResult =
        target.kind === "post"
          ? await togglePostLike(target.id)
          : await toggleWorkLike(target.id);
      if (result.needLogin) {
        router.push(loginHref(target));
        return;
      }
      if (!result.ok) {
        setError(result.message ?? "操作失败，请重试");
        // 回滚到 serverState
        addOptimistic(serverState);
        return;
      }
      setServerState({ active: result.active, count: result.count });
    });
  }

  const isActive = optimistic.active;
  const sizeCls = size === "md" ? "h-8 px-3 text-xs" : "h-7 px-2.5 text-[11px]";
  const iconCls = size === "md" ? "size-3.5" : "size-3";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border transition-colors tabular-nums disabled:opacity-70",
        sizeCls,
        isActive
          ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
          : variant === "solid"
            ? "border-border/60 bg-card/70 text-foreground/85 hover:border-rose-500/40 hover:text-rose-300"
            : "border-border/40 bg-transparent text-muted-foreground hover:border-rose-500/40 hover:text-rose-300",
      )}
      title={error ?? (isActive ? "取消点赞" : "点赞")}
    >
      <Heart className={cn(iconCls, isActive && "fill-rose-400 text-rose-400")} />
      <span>{formatCount(optimistic.count)}</span>
    </button>
  );
}

export function BookmarkButton({
  target,
  initialActive,
  initialCount,
  signedIn,
  showCount = false,
  size = "sm",
  variant = "subtle",
}: {
  target: Target;
  initialActive: boolean;
  initialCount?: number;
  signedIn: boolean;
  /** 帖子收藏不维护计数；作品收藏有 bookmarkCount，可显示 */
  showCount?: boolean;
  size?: Size;
  variant?: "subtle" | "solid";
}) {
  const router = useRouter();
  const [serverState, setServerState] = useState({
    active: initialActive,
    count: Math.max(0, initialCount ?? 0),
  });
  const [optimistic, addOptimistic] = useOptimistic(
    serverState,
    (
      state: { active: boolean; count: number },
      next: { active: boolean; count: number },
    ) => next,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push(loginHref(target));
      return;
    }
    if (pending) return;
    const nextActive = !optimistic.active;
    const nextCount = showCount
      ? Math.max(0, optimistic.count + (nextActive ? 1 : -1))
      : optimistic.count;
    setError(null);
    startTransition(async () => {
      addOptimistic({ active: nextActive, count: nextCount });
      const result: InteractionResult =
        target.kind === "post"
          ? await togglePostBookmark(target.id)
          : await toggleWorkBookmark(target.id);
      if (result.needLogin) {
        router.push(loginHref(target));
        return;
      }
      if (!result.ok) {
        setError(result.message ?? "操作失败，请重试");
        addOptimistic(serverState);
        return;
      }
      setServerState({
        active: result.active,
        count: showCount ? result.count : 0,
      });
    });
  }

  const isActive = optimistic.active;
  const sizeCls = size === "md" ? "h-8 px-3 text-xs" : "h-7 px-2.5 text-[11px]";
  const iconCls = size === "md" ? "size-3.5" : "size-3";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border transition-colors tabular-nums disabled:opacity-70",
        sizeCls,
        isActive
          ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
          : variant === "solid"
            ? "border-border/60 bg-card/70 text-foreground/85 hover:border-amber-500/40 hover:text-amber-300"
            : "border-border/40 bg-transparent text-muted-foreground hover:border-amber-500/40 hover:text-amber-300",
      )}
      title={error ?? (isActive ? "取消收藏" : "收藏")}
    >
      <Bookmark
        className={cn(iconCls, isActive && "fill-amber-400 text-amber-400")}
      />
      {showCount && <span>{formatCount(optimistic.count)}</span>}
    </button>
  );
}
