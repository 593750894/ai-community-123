"use client";

import { useActionState, useState } from "react";

import { FormError, FormField } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import {
  WORK_CATEGORY_META,
  WORK_CATEGORY_ORDER,
  type WorkCategoryValue,
} from "@/lib/work-categories";
import {
  createWorkAction,
  type CreateWorkFormState,
} from "@/lib/works/actions";

const initial: CreateWorkFormState = {};

const COMMON_TOOLS = [
  "Seedance 2.0",
  "Seedance Fast",
  "Runway Gen-3",
  "Kling AI",
  "Veo 3",
  "Pika",
  "Luma Dream Machine",
  "Midjourney",
  "Flux",
  "ComfyUI",
  "Suno",
  "ElevenLabs",
];

export function CreateWorkForm() {
  const [state, action, pending] = useActionState(createWorkAction, initial);
  const [selectedCategory, setSelectedCategory] =
    useState<WorkCategoryValue>("STORY");
  const [toolsInput, setToolsInput] = useState("");
  const [titleLen, setTitleLen] = useState(0);
  const [descLen, setDescLen] = useState(0);

  const appendTool = (tool: string) => {
    const parts = toolsInput
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (parts.includes(tool)) return;
    setToolsInput([...parts, tool].join(", "));
  };

  return (
    <form action={action} className="space-y-5">
      <FormField
        label="作品类型"
        required
        error={state.fieldErrors?.category}
        hint="选择一个最匹配主题的分类，便于在广场页被找到"
      >
        <input type="hidden" name="category" value={selectedCategory} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {WORK_CATEGORY_ORDER.map((c) => {
            const meta = WORK_CATEGORY_META[c];
            const active = selectedCategory === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedCategory(c)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-xs transition-all",
                  active
                    ? `${meta.tone} ring-2 ring-primary/40`
                    : "border-border/60 bg-card/40 text-muted-foreground hover:border-border hover:bg-muted/40",
                )}
              >
                <div className="text-sm font-medium text-foreground/95">
                  {meta.label}
                </div>
                <div className="mt-0.5 text-[11px] opacity-80">{meta.desc}</div>
              </button>
            );
          })}
        </div>
      </FormField>

      <FormField
        label="标题"
        htmlFor="title"
        required
        error={state.fieldErrors?.title}
        hint={`${titleLen}/120`}
      >
        <Input
          id="title"
          name="title"
          required
          maxLength={120}
          onChange={(e) => setTitleLen(e.target.value.length)}
          placeholder="给你的作品起个名字"
          aria-invalid={(state.fieldErrors?.title?.length ?? 0) > 0 || undefined}
        />
      </FormField>

      <FormField
        label="简介"
        htmlFor="description"
        error={state.fieldErrors?.description}
        hint={`选填 · 说一说创作背景、用了什么工具、踩过什么坑 · ${descLen}/2000`}
      >
        <Textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          onChange={(e) => setDescLen(e.target.value.length)}
          placeholder="例：短剧《潮汐》第 3 集，雨夜对话长镜头，挑战 60s 连贯 1080P"
          aria-invalid={(state.fieldErrors?.description?.length ?? 0) > 0 || undefined}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="封面链接"
          htmlFor="thumbnailUrl"
          hint="选填，建议 16:9 静帧图"
          error={state.fieldErrors?.thumbnailUrl}
        >
          <Input
            id="thumbnailUrl"
            name="thumbnailUrl"
            type="url"
            placeholder="https://..."
            aria-invalid={(state.fieldErrors?.thumbnailUrl?.length ?? 0) > 0 || undefined}
          />
        </FormField>
        <FormField
          label="视频链接"
          htmlFor="videoUrl"
          required
          hint="B 站 / YouTube / CDN 直链均可"
          error={state.fieldErrors?.videoUrl}
        >
          <Input
            id="videoUrl"
            name="videoUrl"
            type="url"
            required
            placeholder="https://..."
            aria-invalid={(state.fieldErrors?.videoUrl?.length ?? 0) > 0 || undefined}
          />
        </FormField>
      </div>

      <FormField
        label="使用工具"
        htmlFor="tools"
        error={state.fieldErrors?.tools}
        hint="用逗号分隔，最多 10 个"
      >
        <Input
          id="tools"
          name="tools"
          value={toolsInput}
          onChange={(e) => setToolsInput(e.target.value)}
          maxLength={500}
          placeholder="如：Seedance 2.0, Runway Gen-3, Suno"
          aria-invalid={(state.fieldErrors?.tools?.length ?? 0) > 0 || undefined}
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">快捷添加：</span>
          {COMMON_TOOLS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => appendTool(t)}
              className="rounded-md border border-border/60 bg-card/40 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              + {t}
            </button>
          ))}
        </div>
      </FormField>

      {state.message && !state.ok && <FormError message={state.message} />}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="reset"
          onClick={() => {
            setSelectedCategory("STORY");
            setToolsInput("");
            setTitleLen(0);
            setDescLen(0);
          }}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border/60 bg-background px-4 text-sm transition-colors hover:bg-muted"
        >
          重置
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && <Spinner className="size-4 text-primary-foreground" />}
          {pending ? "发布中…" : "发布作品"}
        </button>
      </div>
    </form>
  );
}
