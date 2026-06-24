"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Stage 17.2：作者撤回 PENDING 申诉。
 * 直接 fetch DELETE /api/me/appeals/[id]，confirm 二次确认。
 */
export function CancelAppealButton({ appealId }: { appealId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确定撤回该申诉？撤回后如有需要可重新提交")
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/me/appeals/${appealId}`, {
        method: "DELETE",
      });
      const json = (await resp.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!resp.ok || !json.success) {
        if (typeof window !== "undefined") {
          window.alert(json.error?.message ?? `撤回失败（HTTP ${resp.status}）`);
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
      className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {submitting ? "撤回中…" : "撤回申诉"}
    </button>
  );
}
