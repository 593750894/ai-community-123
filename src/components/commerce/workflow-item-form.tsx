"use client";

import { useActionState } from "react";

import {
  createWorkflowItemAction,
  updateWorkflowItemAction,
  type SellerActionState,
} from "@/lib/commerce/seller-actions";
import {
  WORKFLOW_ITEM_CATEGORIES,
  WORKFLOW_ITEM_CATEGORY_LABEL,
} from "@/lib/commerce/schemas";
import {
  PublishAsSelector,
  type PublishOrgOption,
} from "@/components/publish/publish-as-selector";

interface Defaults {
  id?: string;
  title?: string;
  description?: string;
  coverUrl?: string | null;
  downloadUrl?: string | null;
  priceCents?: number;
  category?: string;
  tags?: string[];
  toolStack?: string[];
  organizationId?: string | null;
}

const INITIAL: SellerActionState = {};

export function WorkflowItemForm({
  defaults,
  organizations = [],
}: {
  defaults?: Defaults;
  organizations?: PublishOrgOption[];
}) {
  const isEdit = Boolean(defaults?.id);
  const [state, action, pending] = useActionState(
    isEdit ? updateWorkflowItemAction : createWorkflowItemAction,
    INITIAL,
  );

  const priceYuan =
    defaults?.priceCents !== undefined
      ? (defaults.priceCents / 100).toFixed(2)
      : "";

  return (
    <form action={action} className="space-y-4">
      {isEdit && defaults?.id && (
        <input type="hidden" name="id" value={defaults.id} />
      )}

      <PublishAsSelector
        organizations={organizations}
        defaultOrgId={defaults?.organizationId ?? null}
        label="销售身份"
        hint="以企业身份上架时商品卡展示企业品牌；销售款项仍按个人账户结算。"
      />


      {state.message && (
        <div
          className={
            state.ok
              ? "rounded-md border border-tag-emerald-fg/30 bg-tag-emerald-bg/10 px-3 py-2 text-xs text-tag-emerald-fg"
              : "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          }
        >
          {state.message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="标题"
          required
          error={state.fieldErrors?.title?.[0]}
          className="sm:col-span-2"
        >
          <input
            name="title"
            defaultValue={defaults?.title ?? ""}
            placeholder="例如：电商爆款 · ComfyUI 数字人工作流"
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
            maxLength={80}
            required
          />
        </Field>

        <Field
          label="详细描述"
          required
          error={state.fieldErrors?.description?.[0]}
          hint="支持换行；建议说明输入素材、节点流程、产出形式"
          className="sm:col-span-2"
        >
          <textarea
            name="description"
            defaultValue={defaults?.description ?? ""}
            rows={6}
            placeholder="工作流的目标、核心节点、所需输入..."
            className="w-full rounded-md border border-border bg-background/40 px-2 py-1.5 text-sm outline-none focus:border-primary/50"
            maxLength={2000}
            required
          />
        </Field>

        <Field label="分类" required error={state.fieldErrors?.category?.[0]}>
          <select
            name="category"
            defaultValue={defaults?.category ?? "COMFYUI_WORKFLOW"}
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
            required
          >
            {WORKFLOW_ITEM_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {WORKFLOW_ITEM_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="价格（元）"
          required
          error={state.fieldErrors?.priceCents?.[0]}
          hint="0 表示免费；上限 9999.99 元"
        >
          <input
            name="priceYuan"
            type="number"
            step="0.01"
            min="0"
            max="9999.99"
            defaultValue={priceYuan}
            placeholder="例如 19.90"
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
            required
          />
        </Field>

        <Field
          label="封面图 URL"
          error={state.fieldErrors?.coverUrl?.[0]}
          hint="建议 1280×720 横图；留空显示默认图"
        >
          <input
            name="coverUrl"
            defaultValue={defaults?.coverUrl ?? ""}
            placeholder="https://..."
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>

        <Field
          label="下载链接"
          error={state.fieldErrors?.downloadUrl?.[0]}
          hint="工作流文件存放的 URL（上架前必填）"
        >
          <input
            name="downloadUrl"
            defaultValue={defaults?.downloadUrl ?? ""}
            placeholder="https://..."
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>

        <Field
          label="所需工具（逗号分隔）"
          error={state.fieldErrors?.toolStack?.[0]}
          hint="最多 10 个，例如 ComfyUI, FaceFusion"
          className="sm:col-span-2"
        >
          <input
            name="toolStack"
            defaultValue={(defaults?.toolStack ?? []).join(", ")}
            placeholder="ComfyUI, SD 1.5, FaceFusion"
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>

        <Field
          label="标签（逗号分隔）"
          error={state.fieldErrors?.tags?.[0]}
          hint="最多 8 个，便于搜索"
          className="sm:col-span-2"
        >
          <input
            name="tags"
            defaultValue={(defaults?.tags ?? []).join(", ")}
            placeholder="数字人, 电商, 短视频"
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
        >
          {pending ? (isEdit ? "保存中…" : "创建中…") : isEdit ? "保存修改" : "创建草稿"}
        </button>
      </div>

      {!isEdit && (
        <p className="text-[11px] text-muted-foreground">
          创建后保存为草稿；填写下载链接 + 价格后可在编辑页一键上架。
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
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
      {hint && !error && (
        <p className="mt-1 text-[10px] text-muted-foreground/70">{hint}</p>
      )}
      {error && <p className="mt-1 text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}
