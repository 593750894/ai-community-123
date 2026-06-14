"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Stage 11.2：admin 审核企业认证申请的弹窗。
 *
 * 设计：
 *   - 行内按钮（通过 / 驳回）触发同一对话框，预选 decision；
 *   - 通过不要求 note；驳回必须填写 note；
 *   - 提交走 fetch POST /api/admin/organizations/:id/verification；
 *   - 对话框 scaffolding（焦点陷阱 / Esc / 遮罩 / 滚动锁 / portal）走 <Dialog> 原语。
 */

interface VerificationDetails {
  name: string | null;
  regNo: string | null;
  rep: string | null;
  licenseUrl: string | null;
  contact: string | null;
  note: string | null;
}

export function ReviewVerificationDialog({
  orgId,
  orgName,
  details,
}: {
  orgId: string;
  orgName: string;
  details: VerificationDetails;
}) {
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => setDecision("APPROVE")}
        className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 hover:bg-emerald-500/20"
      >
        通过
      </button>
      <button
        type="button"
        onClick={() => setDecision("REJECT")}
        className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300 hover:bg-rose-500/20"
      >
        驳回
      </button>
      {decision && (
        <ReviewForm
          orgId={orgId}
          orgName={orgName}
          details={details}
          decision={decision}
          onClose={() => setDecision(null)}
        />
      )}
    </>
  );
}

function ReviewForm({
  orgId,
  orgName,
  details,
  decision,
  onClose,
}: {
  orgId: string;
  orgName: string;
  details: VerificationDetails;
  decision: "APPROVE" | "REJECT";
  onClose: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function submit() {
    setErrMsg(null);
    const trimmed = note.trim();
    if (decision === "REJECT" && !trimmed) {
      setErrMsg("驳回必须填写原因，便于企业改进资料");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/admin/organizations/${orgId}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: trimmed || undefined }),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!resp.ok || !json.success) {
        setErrMsg(json.error?.message ?? `审核失败（HTTP ${resp.status}）`);
        return;
      }
      onClose();
      router.refresh();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  const approve = decision === "APPROVE";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent ariaLabelledBy="review-verification-dialog-title">
        <DialogHeader>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Stage 11.2 · 企业认证审核
          </div>
          <DialogTitle id="review-verification-dialog-title">
            {approve ? "通过认证" : "驳回认证"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            企业：<span className="font-medium text-foreground">{orgName}</span>
          </p>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-3 text-xs">
            <DetailRow label="营业执照名称" value={details.name} />
            <DetailRow label="注册号" value={details.regNo} mono />
            <DetailRow label="法定代表人" value={details.rep} />
            <DetailRow label="联系方式" value={details.contact} />
            {details.licenseUrl && (
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-muted-foreground">执照</span>
                <a
                  href={details.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary hover:underline"
                >
                  {details.licenseUrl}
                </a>
              </div>
            )}
            {details.note && (
              <div>
                <p className="text-muted-foreground">企业补充说明</p>
                <p className="mt-1 rounded-md border border-border bg-muted/20 px-2 py-1.5">
                  {details.note}
                </p>
              </div>
            )}

            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {approve ? "审核备注（可选，会写入审计日志）" : "驳回原因（必填，会通知到企业）"}
              </span>
              <textarea
                data-autofocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={
                  approve
                    ? "例：资料完整、与公开信息一致"
                    : "例：营业执照号与企业名称不匹配，请重新提交"
                }
                className="block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary/60"
              />
            </label>

            {errMsg && (
              <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
                {errMsg}
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          >
            取消
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className={
              approve
                ? "rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                : "rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/25 disabled:opacity-50"
            }
          >
            {submitting ? "处理中…" : approve ? "确认通过" : "确认驳回"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono" : ""}>
        {value ?? <span className="text-muted-foreground/60">未填写</span>}
      </span>
    </div>
  );
}
