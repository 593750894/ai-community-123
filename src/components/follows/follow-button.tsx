"use client";

import { useRouter } from "next/navigation";
import { Check, UserMinus, UserPlus } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import { cn } from "@/lib/utils";

type Size = "sm" | "md";
type Variant = "default" | "outline" | "compact";

interface FollowButtonProps {
  targetUserId: string;
  /** 当前查询者是否已关注。未登录或为本人时传 false。 */
  initialFollowing: boolean;
  /** 是否同时显示粉丝数；profile 页传 true，列表卡片可传 false */
  initialFollowerCount?: number;
  showCount?: boolean;
  signedIn: boolean;
  /** 是否是本人，本人不显示按钮 */
  isSelf?: boolean;
  /** 登录后回到哪个页面（默认当前路径） */
  loginNext?: string;
  size?: Size;
  variant?: Variant;
  /** 关注/取关成功后回调，可用于刷新外层 */
  onChange?: (next: { following: boolean; followerCount: number }) => void;
}

interface ToggleResponse {
  success: boolean;
  data?: { following: boolean; followerCount: number };
  error?: { code: string; message: string };
}

/**
 * 关注按钮：未登录跳登录页（带 next 回跳）；已登录走 POST /api/follows/toggle。
 * useOptimistic + useTransition 让点击瞬间切状态，请求完用服务端真值校正。
 */
export function FollowButton({
  targetUserId,
  initialFollowing,
  initialFollowerCount = 0,
  showCount = false,
  signedIn,
  isSelf = false,
  loginNext,
  size = "sm",
  variant = "default",
  onChange,
}: FollowButtonProps) {
  const router = useRouter();
  const [hover, setHover] = useState(false);
  const [serverState, setServerState] = useState({
    following: initialFollowing,
    followerCount: Math.max(0, initialFollowerCount),
  });
  const [optimistic, addOptimistic] = useOptimistic(
    serverState,
    (
      _state: { following: boolean; followerCount: number },
      next: { following: boolean; followerCount: number },
    ) => next,
  );
  const [pending, startTransition] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);

  if (isSelf) return null;

  function gotoLogin() {
    const next =
      loginNext ??
      (typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/");
    router.push(`/auth/login?next=${encodeURIComponent(next)}`);
  }

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!signedIn) {
      gotoLogin();
      return;
    }
    if (pending) return;

    const nextFollowing = !optimistic.following;
    const nextCount = Math.max(
      0,
      optimistic.followerCount + (nextFollowing ? 1 : -1),
    );
    setErrMsg(null);

    startTransition(async () => {
      addOptimistic({
        following: nextFollowing,
        followerCount: nextCount,
      });
      try {
        const res = await fetch("/api/follows/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: targetUserId }),
        });
        if (res.status === 401) {
          gotoLogin();
          return;
        }
        const json = (await res.json()) as ToggleResponse;
        if (!json.success || !json.data) {
          setErrMsg(json.error?.message ?? "操作失败，请重试");
          addOptimistic(serverState);
          return;
        }
        const fresh = {
          following: json.data.following,
          followerCount: Math.max(0, json.data.followerCount),
        };
        setServerState(fresh);
        onChange?.(fresh);
      } catch {
        setErrMsg("网络异常，请重试");
        addOptimistic(serverState);
      }
    });
  }

  const isFollowing = optimistic.following;

  const sizeCls =
    size === "md"
      ? "h-8 px-3.5 text-xs"
      : "h-7 px-3 text-[11px]";

  // 已关注 + hover 时切换为"取消关注"红色样式
  const styleCls = (() => {
    if (variant === "compact") {
      return isFollowing
        ? hover
          ? "border-destructive/50 bg-destructive/15 text-destructive"
          : "border-border bg-card/70 text-foreground/85"
        : "border-primary/50 bg-primary/15 text-primary hover:bg-primary/25";
    }
    if (variant === "outline") {
      return isFollowing
        ? hover
          ? "border-destructive/50 bg-destructive/15 text-destructive"
          : "border-border bg-background text-foreground/85"
        : "border-primary/60 bg-transparent text-primary hover:bg-primary/10";
    }
    // default
    return isFollowing
      ? hover
        ? "border-destructive/50 bg-destructive/15 text-destructive"
        : "border-border bg-card text-foreground"
      : "border-transparent bg-primary text-primary-foreground hover:bg-primary/90";
  })();

  const label = isFollowing
    ? hover
      ? "取消关注"
      : "已关注"
    : "关注";

  const Icon = isFollowing
    ? hover
      ? UserMinus
      : Check
    : UserPlus;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={isFollowing}
      disabled={pending}
      title={errMsg ?? label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium transition-colors tabular-nums disabled:opacity-70",
        sizeCls,
        styleCls,
      )}
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
      {showCount && (
        <span className="ml-1 text-[10px] text-muted-foreground/80">
          {optimistic.followerCount}
        </span>
      )}
    </button>
  );
}
