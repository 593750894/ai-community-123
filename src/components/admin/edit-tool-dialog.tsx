"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  adminUpdateTool,
  type AdminUpdateToolState,
} from "@/lib/admin/actions";
import {
  TOOL_CATEGORY_META,
  TOOL_CATEGORY_ORDER,
  TOOL_PRICING_LABEL,
  TOOL_PRICING_VALUES,
} from "@/lib/tools/categories";

const initial: AdminUpdateToolState = {};

type ToolInitial = {
  id: string;
  slug: string;
  name: string;
  description: string;
  url: string;
  category: string;
  pricing: string;
  useCase: string | null;
  tags: string[];
  isOfficial: boolean;
};

// Stage 9：admin 编辑工具的内嵌弹窗。
// slug 不暴露入口（routing key，无 301 兜底）；只展示。

export function EditToolDialog({ tool }: { tool: ToolInitial }) {
  const [state, action, pending] = useActionState(adminUpdateTool, initial);
  const [open, setOpen] = useState(false);
  const closeOnSuccess = useRef(false);

  useEffect(() => {
    if (state.ok && closeOnSuccess.current) {
      closeOnSuccess.current = false;
      setOpen(false);
    }
  }, [state.ok]);

  // Esc 关闭弹窗（WCAG 2.1 modal 要求）。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        编辑
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`edit-tool-${tool.id}-title`}
        >
          <form
            action={(fd) => {
              closeOnSuccess.current = true;
              action(fd);
            }}
            className="w-full max-w-xl space-y-3 rounded-xl border border-border/60 bg-card p-5 shadow-xl"
          >
            <input type="hidden" name="id" value={tool.id} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id={`edit-tool-${tool.id}-title`}
                  className="text-sm font-medium"
                >
                  编辑工具：{tool.name}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  slug <code className="rounded bg-muted/60 px-1">{tool.slug}</code>{" "}
                  不可改（指向 /tools/[slug]）。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
                aria-label="关闭"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="名称" error={state.fieldErrors?.name?.[0]} required>
                <input
                  name="name"
                  defaultValue={tool.name}
                  className="h-8 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
                />
              </Field>
              <Field label="官网" error={state.fieldErrors?.url?.[0]} required>
                <input
                  name="url"
                  defaultValue={tool.url}
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
                  defaultValue={tool.category}
                  className="h-8 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
                >
                  {TOOL_CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>
                      {TOOL_CATEGORY_META[c].emoji} {TOOL_CATEGORY_META[c].label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="计费"
                error={state.fieldErrors?.pricing?.[0]}
                required
              >
                <select
                  name="pricing"
                  defaultValue={tool.pricing}
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
                  rows={3}
                  defaultValue={tool.description}
                  className="w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm outline-none focus:border-primary/50"
                />
              </Field>
              <Field label="适用场景（可选）" className="sm:col-span-2">
                <input
                  name="useCase"
                  defaultValue={tool.useCase ?? ""}
                  className="h-8 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
                />
              </Field>
              <Field label="标签（逗号分隔）" className="sm:col-span-2">
                <input
                  name="tags"
                  defaultValue={tool.tags.join(", ")}
                  className="h-8 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="isOfficial"
                  defaultChecked={tool.isOfficial}
                  className="size-3.5 rounded border-border/60"
                />
                官方推荐
              </label>
              <div className="flex items-center gap-2">
                {state.message && !state.ok && (
                  <span className="text-xs text-rose-400">{state.message}</span>
                )}
                {state.ok && (
                  <span className="text-xs text-emerald-300">
                    {state.message ?? "已保存"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
                >
                  {pending ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
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
