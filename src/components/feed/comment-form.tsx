"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { LogIn, Send } from "lucide-react";

import {
  createCommentAction,
  type CreateCommentFormState,
} from "@/lib/comments/actions";

const initial: CreateCommentFormState = {};

export function CommentForm({
  postId,
  signedIn,
  currentUser,
}: {
  postId: string;
  signedIn: boolean;
  currentUser?: { name: string; avatar: string | null } | null;
}) {
  const [state, action, pending] = useActionState(
    createCommentAction,
    initial,
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 成功时清空 textarea（resetKey 是每次成功递增的数字）
  useEffect(() => {
    if (state.ok && textareaRef.current) {
      textareaRef.current.value = "";
    }
  }, [state.ok, state.resetKey]);

  if (!signedIn) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-sm text-muted-foreground">
        <span>登录后即可发表评论。</span>
        <Link
          href={`/auth/login?next=${encodeURIComponent(`/post/${postId}`)}`}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <LogIn className="size-3" />
          去登录
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="postId" value={postId} />
      <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/40 p-3 focus-within:border-primary/40">
        {currentUser?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="size-8 rounded-full border border-border/60"
          />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {currentUser?.name?.slice(0, 1) ?? "我"}
          </span>
        )}
        <textarea
          ref={textareaRef}
          name="content"
          required
          rows={3}
          maxLength={2000}
          placeholder="说点什么……（最多 2000 字）"
          className="block w-full resize-y bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
        />
      </div>

      {state.fieldErrors?.content?.[0] && (
        <p className="text-xs text-destructive">
          {state.fieldErrors.content[0]}
        </p>
      )}
      {state.message && !state.ok && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {state.message}
        </p>
      )}
      {state.ok && (
        <p className="text-xs text-emerald-400">已发表评论。</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="size-3.5" />
          {pending ? "发布中…" : "发表评论"}
        </button>
      </div>
    </form>
  );
}
