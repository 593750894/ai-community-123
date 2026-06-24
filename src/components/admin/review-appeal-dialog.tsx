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
import { CONTENT_TARGET_LABEL, type ContentTargetType } from "@/lib/content/schemas";

/**
 * Stage 17.2：admin 审核内容申诉的弹窗。
 *
 * 行内两按钮触发同一对话框，预选 decision：
 *  - APPROVE：恢复内容；备注可选，会写审计 + 通知作者。
 *  - REJECT：保持下架；备注必填（≥ 4 字），通知作者会带上备注作为原因。
 */

interface AppealSnapshot {
  targetType: ContentTargetType;
  targetId: string;
  contentSnippet: string | null;
  reason: string;
  appellant: { id: string; name: string; username: string };
  createdAt: string;
}

const VIEW_URL: Record<ContentTargetType, (id: string) => string> = {
  POST: (id) => `/post/${id}`,
  WORK: (id) => `/showcase/${id}`,
  COLLABORATION: (id) => `/collaboration/${id}`,
  // 评论没有独立路由，回到帖子页 + 锚点
  COMMENT: (id) => `/post/?comment=${id}#comment-${id}`,
};

export function ReviewAppealDialog({
  appealId,
  snapshot,
}: {
  appealId: string;
  snapshot: AppealSnapshot;
}) {
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => setDecision("APPROVE")}
        className="rounded-full border border-tag-emerald-fg/30 bg-tag-emerald-bg/10 px-2 py-0.5 text-[11px] text-tag-emerald-fg hover:bg-tag-emerald-bg/20"
      >
        通过
      </button>
      <button
        type="button"
        onClick={() => setDecision("REJECT")}
        className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive hover:bg-destructive/20"
      >
        驳回
      </button>
      {decision && (
        <ReviewForm
          appealId={appealId}
          snapshot={snapshot}
          decision={decision}
          onClose={() => setDecision(null)}
        />
      )}
    </>
  );
}

function ReviewForm({
  appealId,
  snapshot,
  decision,
  onClose,
}: {
  appealId: string;
  snapshot: AppealSnapshot;
  decision: "APPROVE" | "REJECT";
  onClose: () => void;
}) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function submit() {
    setErrMsg(null);
    const trimmed = reviewNote.trim();
    if (decision === "REJECT" && trimmed.length < 4) {
      setErrMsg("驳回必须填写备注（至少 4 字），便于作者理解结果");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`/api/admin/appeals/${appealId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewNote: trimmed || undefined }),
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent ariaLabelledBy="review-appeal-dialog-title">
        <DialogHeader>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Stage 17.2 · 内容申诉审核
          </div>
          <DialogTitle id="review-appeal-dialog-title">
            {approve ? "通过申诉并恢复内容" : "驳回申诉"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            申诉人：
            <span className="font-medium text-foreground">
              {snapshot.appellant.name}
            </span>{" "}
            @{snapshot.appellant.username}
          </p>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-3 text-xs">
            <DetailRow
              label="内容类型"
              value={CONTENT_TARGET_LABEL[snapshot.targetType]}
            />
            <DetailRow label="目标 ID" value={snapshot.targetId} mono />
            <DetailRow
              label="内容摘要"
              value={snapshot.contentSnippet ?? "（内容已不可读）"}
            />
            <DetailRow
              label="提交时间"
              value={new Date(snapshot.createdAt).toLocaleString("zh-CN")}
            />
            <a
              href={VIEW_URL[snapshot.targetType](snapshot.targetId)}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-primary hover:underline"
            >
              在新标签中查看 →
            </a>

            <div>
              <p className="text-muted-foreground">申诉理由</p>
              <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-muted/20 px-2 py-1.5">
                {snapshot.reason}
              </p>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {approve
                  ? "审核备注（可选，会写入审计 + 通知作者）"
                  : "驳回备注（必填 ≥ 4 字，会通知作者）"}
              </span>
              <textarea
                data-autofocus
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={
                  approve
                    ? "例：经复核内容未违反社区规则"
                    : "例：内容仍违反社区规则第 3 条「禁止散布广告」"
                }
                className="block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary/60"
              />
            </label>

            {errMsg && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
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
                ? "rounded-full border border-tag-emerald-fg/40 bg-tag-emerald-bg/15 px-3 py-1.5 text-xs font-medium text-tag-emerald-fg hover:bg-tag-emerald-bg/25 disabled:opacity-50"
                : "rounded-full border border-destructive/40 bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25 disabled:opacity-50"
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
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className={mono ? "break-all font-mono" : "break-words"}>{value}</span>
    </div>
  );
}
