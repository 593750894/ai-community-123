"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  CONTENT_TARGET_LABEL,
  type ContentTargetType,
} from "@/lib/content/schemas";

/**
 * Stage 17.2：作者发起申诉的表单。
 *
 * 由 /me/appeals 页面在选中某条被下架内容时渲染。表单走 fetch POST /api/me/appeals，
 * 成功后 router.refresh() 让列表显示新提交的 PENDING 申诉。
 *
 * 校验：
 *  - reason ≥ 10 字、≤ 1000 字（Zod 同步在服务端再 validate）。
 *  - 提交期间禁用按钮防双击。
 */
export function SubmitAppealForm({
  targetType,
  targetId,
  contentSnippet,
  deletionReason,
  retry,
}: {
  targetType: ContentTargetType;
  targetId: string;
  contentSnippet: string;
  deletionReason: string | null;
  /** 是否是「重试申诉」（之前 REJECTED）。仅影响默认提示文案。 */
  retry?: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setErrMsg("申诉理由至少 10 字");
      return;
    }
    if (trimmed.length > 1000) {
      setErrMsg("申诉理由不超过 1000 字");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch("/api/me/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason: trimmed }),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!resp.ok || !json.success) {
        setErrMsg(json.error?.message ?? `提交失败（HTTP ${resp.status}）`);
        return;
      }
      setReason("");
      router.refresh();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border border-border bg-card/40 p-4"
    >
      <div className="text-xs">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {CONTENT_TARGET_LABEL[targetType]} · 下架快照
        </p>
        <p className="mt-1 line-clamp-3 break-words text-foreground">
          {contentSnippet}
        </p>
        {deletionReason && (
          <p className="mt-1 text-muted-foreground">
            下架原因：<span className="text-foreground">{deletionReason}</span>
          </p>
        )}
      </div>

      <label className="block space-y-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {retry ? "重新申诉理由（10-1000 字）" : "申诉理由（10-1000 字）"}
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          minLength={10}
          maxLength={1000}
          placeholder={
            retry
              ? "请补充新的证据或上下文，说明为何应当恢复…"
              : "请说明你认为不应当被下架的具体理由，便于审核员复核…"
          }
          className="block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary/60"
        />
        <span className="block text-right text-[10px] text-muted-foreground/70 tabular-nums">
          {reason.trim().length} / 1000
        </span>
      </label>

      {errMsg && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {errMsg}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || reason.trim().length < 10}
          className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-50"
        >
          {submitting ? "提交中…" : "提交申诉"}
        </button>
      </div>
    </form>
  );
}
