"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  adminUpdateTool,
  type AdminUpdateToolState,
} from "@/lib/admin/actions";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const titleId = `edit-tool-${tool.id}-title`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        编辑
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" ariaLabelledBy={titleId}>
          <form
            action={(fd) => {
              closeOnSuccess.current = true;
              action(fd);
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <input type="hidden" name="id" value={tool.id} />
            <DialogHeader>
              <DialogTitle id={titleId} className="text-sm font-medium">
                编辑工具：{tool.name}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground">
                slug <code className="rounded bg-muted/60 px-1">{tool.slug}</code>{" "}
                不可改（指向 /tools/[slug]）。
              </p>
            </DialogHeader>

            <DialogBody className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="名称" error={state.fieldErrors?.name?.[0]} required>
                  <input
                    name="name"
                    defaultValue={tool.name}
                    className="h-8 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
                  />
                </Field>
                <Field label="官网" error={state.fieldErrors?.url?.[0]} required>
                  <input
                    name="url"
                    defaultValue={tool.url}
                    className="h-8 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
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
                    className="h-8 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
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
                    className="h-8 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
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
                    className="w-full rounded-md border border-border bg-background/40 px-2 py-1.5 text-sm outline-none focus:border-primary/50"
                  />
                </Field>
                <Field label="适用场景（可选）" className="sm:col-span-2">
                  <input
                    name="useCase"
                    defaultValue={tool.useCase ?? ""}
                    className="h-8 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
                  />
                </Field>
                <Field label="标签（逗号分隔）" className="sm:col-span-2">
                  <input
                    name="tags"
                    defaultValue={tool.tags.join(", ")}
                    className="h-8 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
                  />
                </Field>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="isOfficial"
                  defaultChecked={tool.isOfficial}
                  className="size-3.5 rounded border-border"
                />
                官方推荐
              </label>
            </DialogBody>

            <DialogFooter>
              {state.message && !state.ok && (
                <span className="mr-auto text-xs text-rose-400">
                  {state.message}
                </span>
              )}
              {state.ok && (
                <span className="mr-auto text-xs text-tag-emerald-fg">
                  {state.message ?? "已保存"}
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-50"
              >
                {pending ? "保存中…" : "保存"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
