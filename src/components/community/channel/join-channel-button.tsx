"use client";

import { useRouter } from "next/navigation";
import { Check, LogOut, Plus } from "lucide-react";
import {
  useOptimistic,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { cn } from "@/lib/utils";

// 触屏检测：用 useSyncExternalStore 直接订阅 matchMedia，避免 set-state-in-effect 警告。
function subscribeCoarsePointer(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia("(hover: none)");
  mql.addEventListener?.("change", onChange);
  return () => mql.removeEventListener?.("change", onChange);
}
function readCoarsePointer(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(hover: none)").matches;
}
function serverCoarsePointer(): boolean {
  // SSR 时还不知道，默认 false（桌面优先），客户端 hydrate 后会立即纠正。
  return false;
}

type Size = "sm" | "md";

interface JoinChannelButtonProps {
  channelId: string;
  initialMember: boolean;
  initialMemberCount: number;
  signedIn: boolean;
  size?: Size;
  /** 登录后回到哪个页面（默认当前路径） */
  loginNext?: string;
  /** 切换成功后回调；本组件本身也会调用 router.refresh() 让上层 SSR 数据同步。 */
  onChange?: (next: { member: boolean; memberCount: number }) => void;
}

interface ToggleResponse {
  success: boolean;
  data?: { member: boolean; memberCount: number };
  error?: { code: string; message: string };
}

/**
 * 加入/退出频道按钮：未登录跳登录页（带 next 回跳），已登录走
 * POST /api/channels/:channelId/members/toggle。
 *
 * 已加入态：
 *   - 桌面 hover → 切换为「退出频道」红色样式；
 *   - 触屏 (`hover: none`) → 直接显示「退出频道」，避免「已加入」标签下的破坏性首次点击。
 *
 * 成功后会触发 router.refresh()，让外层 server component 的 channel.memberCount / 成员数 chip 同步。
 */
export function JoinChannelButton({
  channelId,
  initialMember,
  initialMemberCount,
  signedIn,
  size = "sm",
  loginNext,
  onChange,
}: JoinChannelButtonProps) {
  const router = useRouter();
  const [hover, setHover] = useState(false);
  const coarsePointer = useSyncExternalStore(
    subscribeCoarsePointer,
    readCoarsePointer,
    serverCoarsePointer,
  );

  const [serverState, setServerState] = useState({
    member: initialMember,
    memberCount: Math.max(0, initialMemberCount),
  });
  // React 推荐的"在渲染期间根据 prop 变化调整 state"模式（避免 useEffect set-state 警告）。
  // 父级 SSR 重新挂载（router.refresh）后会把新的 initialMember/Count 传进来；
  // 如果没和上次同步过，就立刻 schedule 一次 setState 让 serverState 跟随。
  const [lastInitialMember, setLastInitialMember] = useState(initialMember);
  const [lastInitialCount, setLastInitialCount] = useState(initialMemberCount);
  if (
    initialMember !== lastInitialMember ||
    initialMemberCount !== lastInitialCount
  ) {
    setLastInitialMember(initialMember);
    setLastInitialCount(initialMemberCount);
    setServerState({
      member: initialMember,
      memberCount: Math.max(0, initialMemberCount),
    });
  }

  const [optimistic, addOptimistic] = useOptimistic(
    serverState,
    (
      _state: { member: boolean; memberCount: number },
      next: { member: boolean; memberCount: number },
    ) => next,
  );
  const [pending, startTransition] = useTransition();
  const [errMsg, setErrMsg] = useState<string | null>(null);

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

    const nextMember = !optimistic.member;
    const nextCount = Math.max(
      0,
      optimistic.memberCount + (nextMember ? 1 : -1),
    );
    setErrMsg(null);

    startTransition(async () => {
      addOptimistic({ member: nextMember, memberCount: nextCount });
      try {
        const res = await fetch(
          `/api/channels/${encodeURIComponent(channelId)}/members/toggle`,
          { method: "POST" },
        );
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
          member: json.data.member,
          memberCount: Math.max(0, json.data.memberCount),
        };
        setServerState(fresh);
        onChange?.(fresh);
        // 让外层 SSR 数据（如 ChannelHeader 顶部「N 位成员」chip）同步。
        router.refresh();
      } catch {
        setErrMsg("网络异常，请重试");
        addOptimistic(serverState);
      }
    });
  }

  const isMember = optimistic.member;
  // 触屏没有 hover，始终把 leave 意图暴露出来，避免「已加入」按钮第一次点就退群。
  const showLeave = isMember && (hover || coarsePointer);
  const sizeCls =
    size === "md" ? "h-8 px-3.5 text-xs" : "h-7 px-3 text-[11px]";

  const styleCls = isMember
    ? showLeave
      ? "border-rose-500/50 bg-rose-500/15 text-rose-300"
      : "border-border/60 bg-card/70 text-foreground/85"
    : "border-transparent bg-primary text-primary-foreground hover:bg-primary/90";

  const label = isMember ? (showLeave ? "退出频道" : "已加入") : "加入频道";
  const Icon = isMember ? (showLeave ? LogOut : Check) : Plus;
  // 触屏 + 已加入态，把可读名称强制改成「退出频道」，让 SR 用户读到的就是即将发生的动作。
  const ariaLabel = isMember ? (coarsePointer ? "退出频道" : label) : "加入频道";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      aria-pressed={isMember}
      aria-label={ariaLabel}
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
    </button>
  );
}
