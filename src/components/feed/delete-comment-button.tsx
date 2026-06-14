"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

/**
 * 删除按钮：评论作者 / Admin 可见。
 * 有回复的评论删除前弹 confirm，提示"回复将变为顶级评论"。
 */
export function DeleteCommentButton({
  commentId,
  hasReplies,
}: {
  commentId: string;
  hasReplies: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    const msg = hasReplies
      ? "此评论有回复，删除后这些回复将变为顶级评论。确认删除？"
      : "确认删除这条评论？";
    if (!window.confirm(msg)) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/comments/${commentId}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          setError(j?.error?.message ?? "删除失败");
          return;
        }
        router.refresh();
      } catch {
        setError("网络错误，请重试");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={error ?? "删除"}
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      <Trash2 className="size-3" />
      删除
    </button>
  );
}
