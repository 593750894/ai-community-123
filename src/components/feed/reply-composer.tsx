"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send, X } from "lucide-react";

import {
  createCommentAction,
  type CreateCommentFormState,
} from "@/lib/comments/actions";

const initial: CreateCommentFormState = {};

/**
 * 回复编辑器 —— 复用 createCommentAction，预填 parentId/postId。
 * 提交成功后通知父组件关闭。
 */
export function ReplyComposer({
  postId,
  parentId,
  replyingToName,
  onClose,
}: {
  postId: string;
  parentId: string;
  replyingToName: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(
    createCommentAction,
    initial,
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (state.ok) {
      // 给用户一点时间看到 "已发表" 反馈再关掉
      const t = setTimeout(onClose, 500);
      return () => clearTimeout(t);
    }
  }, [state.ok, state.resetKey, onClose]);

  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="parentId" value={parentId} />
      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 p-2 focus-within:border-primary/40">
        <textarea
          ref={textareaRef}
          name="content"
          required
          rows={2}
          maxLength={2000}
          autoFocus
          placeholder={`回复 @${replyingToName}…`}
          className="block w-full resize-y bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
        />
      </div>

      {state.fieldErrors?.content?.[0] && (
        <p className="text-xs text-destructive">
          {state.fieldErrors.content[0]}
        </p>
      )}
      {state.message && !state.ok && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-xs text-destructive">
          {state.message}
        </p>
      )}
      {state.ok && <p className="text-xs text-emerald-400">已发表回复。</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 px-2 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          <X className="size-3" />
          取消
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="size-3" />
          {pending ? "发布中…" : "发表回复"}
        </button>
      </div>
    </form>
  );
}
