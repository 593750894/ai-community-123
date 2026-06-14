"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // 提交过程中禁止关闭（保留原行为：背景点击在 submitting 时被忽略）。
        if (submitting) return;
        if (!next) onClose();
      }}
    >
      <DialogContent ariaLabelledBy="report-dialog-title">
        <DialogHeader>
          <DialogTitle
            id="report-dialog-title"
            className="flex items-center gap-2 tracking-tight"
          >
            <Flag className="size-4 text-rose-300" />
            举报{REPORT_TARGET_LABEL[targetType] ?? "内容"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            所有举报会发送给管理员审核。重复举报或恶意举报可能影响你的账号信誉。
          </p>
        </DialogHeader>

        {done ? (
          <DialogBody>
            <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              已收到你的举报，管理员会尽快处理。
            </div>
          </DialogBody>
        ) : (
          <form onSubmit={submit}>
            <DialogBody className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="reason" className="text-sm font-medium">
                  原因 <span className="text-destructive">*</span>
                </label>
                <select
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ReportReason)}
                  disabled={submitting}
                  className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
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
                  className="block w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
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
            </DialogBody>

            <DialogFooter>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-9 items-center justify-center rounded-full bg-rose-500/90 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "提交中…" : "提交举报"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
