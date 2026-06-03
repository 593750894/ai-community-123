"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, X } from "lucide-react";

import {
  REPORT_REASONS,
  REPORT_REASON_LABEL,
  REPORT_TARGET_LABEL,
  type ReportReason,
  type ReportTargetTypeValue,
} from "@/lib/reports/schemas";

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetTypeValue;
  targetId: string;
  /** 未登录时跳哪 */
  loginNext?: string;
}

export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  loginNext,
}: ReportDialogProps) {
  const router = useRouter();
  const [reason, setReason] = useState<ReportReason>("SPAM");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reason,
          description: description.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        const next = loginNext ?? window.location.pathname;
        router.push(`/auth/login?next=${encodeURIComponent(next)}`);
        return;
      }
      const json = (await res.json().catch(() => null)) as
        | { success: boolean; data?: unknown; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.success) {
        setError(json?.error?.message ?? "提交失败，请稍后再试");
        return;
      }
      setDone(true);
      setTimeout(onClose, 1200);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>

        <h2
          id="report-dialog-title"
          className="mb-1 flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <Flag className="size-4 text-rose-300" />
          举报{REPORT_TARGET_LABEL[targetType] ?? "内容"}
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          所有举报会发送给管理员审核。重复举报或恶意举报可能影响你的账号信誉。
        </p>

        {done ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            已收到你的举报，管理员会尽快处理。
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reason" className="text-sm font-medium">
                原因 <span className="text-destructive">*</span>
              </label>
              <select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                disabled={submitting}
                className="block h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              >
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {REPORT_REASON_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="description" className="text-sm font-medium">
                  补充说明（可选）
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {description.length}/500
                </span>
              </div>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                disabled={submitting}
                placeholder="详细描述违规情况，方便管理员判断。"
                rows={4}
                className="block w-full resize-y rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {error && (
              <p
                className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border/60 px-3 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-500/90 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "提交中…" : "提交举报"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
