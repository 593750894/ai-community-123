"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Heart } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  toggleCommentLike,
  type InteractionResult,
} from "@/lib/interactions/actions";

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * 评论点赞按钮 —— 镜像 LikeButton 的 useOptimistic + useTransition 模式。
 * 未登录跳 /auth/login?next=<postUrl>#comment-<id>。
 */
export function CommentLikeButton({
  commentId,
  postId,
  initialActive,
  initialCount,
  signedIn,
}: {
  commentId: string;
  postId: string;
  initialActive: boolean;
  initialCount: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [serverState, setServerState] = useState({
    active: initialActive,
    count: Math.max(0, initialCount),
  });
  const [optimistic, addOptimistic] = useOptimistic(
    serverState,
    (
      _state: { active: boolean; count: number },
      next: { active: boolean; count: number },
    ) => next,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const loginHref = `/auth/login?next=${encodeURIComponent(`/post/${postId}#comment-${commentId}`)}`;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      router.push(loginHref);
      return;
    }
    if (pending) return;
    const nextActive = !optimistic.active;
    const nextCount = Math.max(0, optimistic.count + (nextActive ? 1 : -1));
    setError(null);
    startTransition(async () => {
      addOptimistic({ active: nextActive, count: nextCount });
      const result: InteractionResult = await toggleCommentLike(commentId);
      if (result.needLogin) {
        addOptimistic(serverState);
        router.push(loginHref);
        return;
      }
      if (!result.ok) {
        setError(result.message ?? "操作失败，请重试");
        addOptimistic(serverState);
        return;
      }
      setServerState({ active: result.active, count: result.count });
    });
  }

  const isActive = optimistic.active;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      disabled={pending}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] tabular-nums transition-colors disabled:opacity-70",
        isActive
          ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
          : "border-border/40 bg-transparent text-muted-foreground hover:border-rose-500/40 hover:text-rose-300",
      )}
      title={error ?? (isActive ? "取消点赞" : "点赞")}
    >
      <Heart className={cn("size-3", isActive && "fill-rose-400 text-rose-400")} />
      {optimistic.count > 0 && <span>{formatCount(optimistic.count)}</span>}
    </button>
  );
}
