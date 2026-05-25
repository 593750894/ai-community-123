"use client";

import { useActionState } from "react";

import {
  adminCreateTool,
  type AdminCreateToolState,
} from "@/lib/admin/actions";
import {
  TOOL_CATEGORY_META,
  TOOL_CATEGORY_ORDER,
  TOOL_PRICING_LABEL,
  TOOL_PRICING_VALUES,
} from "@/lib/tools/categories";

const initial: AdminCreateToolState = {};

// 阶段 11：管理后台 - 新增工具表单。
// 字段对齐 Tool schema 的必填项；slug 在后端自动生成。

export function CreateToolForm() {
  const [state, action, pending] = useActionState(adminCreateTool, initial);

  return (
    <form
      action={action}
      className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">添加新工具</h3>
          <p className="text-xs text-muted-foreground">
            录入后立即出现在 /tools 页面。
          </p>
        </div>
        {state.ok && (
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-300">
            {state.message ?? "已添加"}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="名称" error={state.fieldErrors?.name?.[0]} required>
          <input
            name="name"
            placeholder="例如 Seedance 2.0"
            className="h-8 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>
        <Field label="官网 / 链接" error={state.fieldErrors?.url?.[0]} required>
          <input
            name="url"
            placeholder="https://..."
            className="h-8 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>
        <Field
          label="分类"
          error={state.fieldErrors?.category?.[0]}
          required
        >
          <select
            name="category"
            defaultValue="TEXT_TO_VIDEO"
            className="h-8 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          >
            {TOOL_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {TOOL_CATEGORY_META[c].emoji} {TOOL_CATEGORY_META[c].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="计费" error={state.fieldErrors?.pricing?.[0]} required>
          <select
            name="pricing"
            defaultValue="FREE"
            className="h-8 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          >
            {TOOL_PRICING_VALUES.map((p) => (
              <option key={p} value={p}>
                {TOOL_PRICING_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="描述"
          error={state.fieldErrors?.description?.[0]}
          required
          className="sm:col-span-2"
        >
          <textarea
            name="description"
            rows={2}
            placeholder="一句话讲清楚这个工具是干嘛的"
            className="w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm outline-none focus:border-primary/50"
          />
        </Field>
        <Field label="适用场景（可选）" className="sm:col-span-2">
          <input
            name="useCase"
            placeholder="例如 电商批量短视频"
            className="h-8 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>
        <Field label="标签（逗号分隔）" className="sm:col-span-2">
          <input
            name="tags"
            placeholder="文生视频, 火山方舟"
            className="h-8 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="isOfficial"
            className="size-3.5 rounded border-border/60"
          />
          官方推荐（置顶展示）
        </label>
        <div className="flex items-center gap-2">
          {state.message && !state.ok && (
            <span className="text-xs text-rose-400">{state.message}</span>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
          >
            {pending ? "提交中…" : "添加工具"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}
