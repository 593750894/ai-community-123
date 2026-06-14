"use client";

import { useRouter } from "next/navigation";
import { Star, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";

interface Props {
  toolSlug: string;
  signedIn: boolean;
  loginNext: string;
  initialStars: number | null;
  initialComment: string | null;
}

interface SubmitResponse {
  success: boolean;
  data?: {
    rating: { stars: number; comment: string | null };
    summary: { avgRating: number | null; ratingCount: number };
  };
  error?: { code: string; message: string };
}

export function ToolRatingForm({
  toolSlug,
  signedIn,
  loginNext,
  initialStars,
  initialComment,
}: Props) {
  const router = useRouter();
  const [stars, setStars] = useState<number>(initialStars ?? 0);
  const [hoverStars, setHoverStars] = useState<number>(0);
  const [comment, setComment] = useState<string>(initialComment ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const hasExisting = initialStars != null;
  const display = hoverStars || stars;

  function gotoLogin() {
    router.push(`/auth/login?next=${encodeURIComponent(loginNext)}`);
  }

  function submit() {
    if (!signedIn) return gotoLogin();
    if (pending) return;
    if (stars < 1 || stars > 5) {
      setMsg({ kind: "err", text: "请先选择 1-5 颗星" });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tools/${toolSlug}/ratings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stars,
            comment: comment.trim() || null,
          }),
        });
        if (res.status === 401) {
          gotoLogin();
          return;
        }
        const json = (await res.json()) as SubmitResponse;
        if (!json.success || !json.data) {
          setMsg({
            kind: "err",
            text: json.error?.message ?? "保存失败，请重试",
          });
          return;
        }
        setMsg({ kind: "ok", text: "评分已保存" });
        router.refresh();
      } catch {
        setMsg({ kind: "err", text: "网络异常，请重试" });
      }
    });
  }

  function remove() {
    if (!signedIn) return gotoLogin();
    if (pending) return;
    if (!confirm("确认撤回你的评分？")) return;
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tools/${toolSlug}/ratings`, {
          method: "DELETE",
        });
        if (res.status === 401) {
          gotoLogin();
          return;
        }
        const json = (await res.json()) as SubmitResponse;
        if (!json.success) {
          setMsg({
            kind: "err",
            text: json.error?.message ?? "撤回失败，请重试",
          });
          return;
        }
        setStars(0);
        setComment("");
        setMsg({ kind: "ok", text: "评分已撤回" });
        router.refresh();
      } catch {
        setMsg({ kind: "err", text: "网络异常，请重试" });
      }
    });
  }

  return (
    <div className="surface-card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {hasExisting ? "你的评分" : "给这个工具打分"}
        </h3>
        {!signedIn && (
          <button
            type="button"
            onClick={gotoLogin}
            className="text-xs text-primary hover:underline"
          >
            登录后评分
          </button>
        )}
      </div>

      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setHoverStars(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= display;
          return (
            <button
              key={n}
              type="button"
              disabled={pending}
              onClick={() => signedIn ? setStars(n) : gotoLogin()}
              onMouseEnter={() => setHoverStars(n)}
              aria-label={`${n} 星`}
              className="rounded p-1 transition-transform duration-200 hover:scale-110 disabled:cursor-not-allowed"
            >
              <Star
                className={cn(
                  "size-6 transition-colors",
                  active
                    ? "fill-amber-300 text-amber-300"
                    : "text-muted-foreground/40",
                )}
              />
            </button>
          );
        })}
        <span className="ml-2 text-xs text-muted-foreground tabular-nums">
          {display > 0 ? `${display}.0 / 5` : "未选择"}
        </span>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 500))}
        disabled={pending || !signedIn}
        placeholder="（可选）说说你的真实使用体验、最适合的场景、踩过的坑..."
        rows={3}
        className="resize-y rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-ring disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{comment.length}/500</span>
        <div className="flex items-center gap-2">
          {hasExisting && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 px-2.5 py-1 text-xs text-rose-300 transition-colors hover:bg-rose-500/15 disabled:opacity-50"
            >
              <Trash2 className="size-3" />
              撤回
            </button>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={pending || stars < 1}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "保存中..." : hasExisting ? "更新评分" : "提交评分"}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            msg.kind === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300",
          )}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
