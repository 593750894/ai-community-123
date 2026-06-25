"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  BLOCKED_WORD_SCOPE_VALUES,
  BLOCKED_WORD_SEVERITY_VALUES,
} from "@/lib/content/schemas";

/**
 * Stage 17.3：admin 新增违禁词的内联表单。
 * 走 POST /api/admin/blocked-words，成功后 router.refresh() 让列表刷新。
 */

const SEVERITY_LABEL: Record<(typeof BLOCKED_WORD_SEVERITY_VALUES)[number], string> = {
  WARN: "WARN（仅告警）",
  BLOCK: "BLOCK（拒绝创建）",
};

const SCOPE_LABEL: Record<(typeof BLOCKED_WORD_SCOPE_VALUES)[number], string> = {
  ALL: "全部内容",
  POST: "帖子",
  WORK: "作品",
  COMMENT: "评论",
  COLLABORATION: "合作",
  MESSAGE: "私信 / 群消息",
  WORKFLOW_ITEM: "工作流商品",
  USER: "个人主页（昵称 / 简介）",
  ORGANIZATION: "企业（名称 / 简介）",
};

export function CreateBlockedWordForm() {
  const router = useRouter();
  const [pattern, setPattern] = useState("");
  const [severity, setSeverity] =
    useState<(typeof BLOCKED_WORD_SEVERITY_VALUES)[number]>("BLOCK");
  const [scope, setScope] =
    useState<(typeof BLOCKED_WORD_SCOPE_VALUES)[number]>("ALL");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrMsg(null);
    setOkMsg(null);
    const trimmed = pattern.trim();
    if (trimmed.length < 2) {
      setErrMsg("关键词至少 2 个字符");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch("/api/admin/blocked-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: trimmed,
          severity,
          scope,
          note: note.trim() || undefined,
        }),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!resp.ok || !json.success) {
        setErrMsg(json.error?.message ?? `提交失败（HTTP ${resp.status}）`);
        return;
      }
      setPattern("");
      setNote("");
      setOkMsg("已新增，列表已刷新");
      router.refresh();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "网络异常");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-xs">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_1fr]">
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            关键词
          </span>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            minLength={2}
            maxLength={64}
            placeholder="如：钓鱼广告"
            className="block h-9 w-full rounded-md border border-border bg-background px-2 outline-none focus:border-primary/60"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            严重度
          </span>
          <select
            value={severity}
            onChange={(e) =>
              setSeverity(
                e.target.value as (typeof BLOCKED_WORD_SEVERITY_VALUES)[number],
              )
            }
            className="block h-9 w-full rounded-md border border-border bg-background px-2 outline-none focus:border-primary/60"
          >
            {BLOCKED_WORD_SEVERITY_VALUES.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            适用范围
          </span>
          <select
            value={scope}
            onChange={(e) =>
              setScope(
                e.target.value as (typeof BLOCKED_WORD_SCOPE_VALUES)[number],
              )
            }
            className="block h-9 w-full rounded-md border border-border bg-background px-2 outline-none focus:border-primary/60"
          >
            {BLOCKED_WORD_SCOPE_VALUES.map((s) => (
              <option key={s} value={s}>
                {SCOPE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          备注（可选，≤ 200 字）
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="为何加入此词、来源举报 ID 等"
          className="block h-9 w-full rounded-md border border-border bg-background px-2 outline-none focus:border-primary/60"
        />
      </label>

      {errMsg && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
          {errMsg}
        </div>
      )}
      {okMsg && (
        <div className="rounded-md border border-tag-emerald-fg/30 bg-tag-emerald-bg/15 px-2 py-1.5 text-[11px] text-tag-emerald-fg">
          {okMsg}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || pattern.trim().length < 2}
          className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25 disabled:opacity-50"
        >
          {submitting ? "提交中…" : "新增违禁词"}
        </button>
      </div>
    </form>
  );
}
