"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Stage 17.3：admin 单行删除违禁词。confirm 二次确认 + 触发 router.refresh()。
 */
export function DeleteBlockedWordButton({
  wordId,
  pattern,
}: {
  wordId: string;
  pattern: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`确定删除违禁词 "${pattern}"？历史命中审计不会被删除。`)
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/admin/blocked-words/${wordId}`, {
        method: "DELETE",
      });
      const json = (await resp.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!resp.ok || !json.success) {
        if (typeof window !== "undefined") {
          window.alert(json.error?.message ?? `删除失败（HTTP ${resp.status}）`);
        }
        return;
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={submitting}
      className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive hover:bg-destructive/20 disabled:opacity-50"
    >
      {submitting ? "删除中…" : "删除"}
    </button>
  );
}
