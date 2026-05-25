"use client";

import { useActionState, useState } from "react";

import { FormError, FormField } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import {
  POST_TYPE_META,
  POST_TYPE_ORDER,
  type PostTypeValue,
} from "@/lib/post-types";
import {
  createPostAction,
  type CreatePostFormState,
} from "@/lib/posts/actions";

const initial: CreatePostFormState = {};

export type ChannelOption = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
};

export function CreatePostForm({
  channels,
  defaultChannelId,
}: {
  channels: ChannelOption[];
  defaultChannelId?: string;
}) {
  const [state, action, pending] = useActionState(createPostAction, initial);
  const [selectedType, setSelectedType] = useState<PostTypeValue>("DISCUSSION");
  const [titleLen, setTitleLen] = useState(0);
  const [contentLen, setContentLen] = useState(0);

  return (
    <form action={action} className="space-y-5">
      <FormField
        label="频道"
        htmlFor="channelId"
        required
        error={state.fieldErrors?.channelId}
      >
        <Select
          id="channelId"
          name="channelId"
          defaultValue={defaultChannelId ?? ""}
          required
        >
          <option value="" disabled>
            请选择频道
          </option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {(c.icon ?? "#") + " " + c.name} · {c.slug}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="帖子类型"
        required
        error={state.fieldErrors?.type}
        hint="选择一个最贴近主题的类型，便于读者过滤"
      >
        <input type="hidden" name="type" value={selectedType} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {POST_TYPE_ORDER.map((t) => {
            const meta = POST_TYPE_META[t];
            const active = selectedType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedType(t)}
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
        hint={`一句话说清楚你想分享什么 · ${titleLen}/120`}
      >
        <Input
          id="title"
          name="title"
          required
          maxLength={120}
          onChange={(e) => setTitleLen(e.target.value.length)}
          placeholder="例：可灵 2.0 vs Seedance 真人同 prompt 对比记录"
          aria-invalid={(state.fieldErrors?.title?.length ?? 0) > 0 || undefined}
        />
      </FormField>

      <FormField
        label="正文"
        htmlFor="content"
        required
        error={state.fieldErrors?.content}
        hint={`支持纯文本，不支持 markdown 渲染 · ${contentLen}/8000`}
      >
        <Textarea
          id="content"
          name="content"
          required
          rows={8}
          maxLength={8000}
          onChange={(e) => setContentLen(e.target.value.length)}
          placeholder="把你的工作流、prompt、感受讲清楚"
          aria-invalid={(state.fieldErrors?.content?.length ?? 0) > 0 || undefined}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="视频链接"
          htmlFor="videoUrl"
          hint="选填"
          error={state.fieldErrors?.videoUrl}
        >
          <Input
            id="videoUrl"
            name="videoUrl"
            type="url"
            placeholder="https://..."
            aria-invalid={(state.fieldErrors?.videoUrl?.length ?? 0) > 0 || undefined}
          />
        </FormField>
        <FormField
          label="图片链接"
          htmlFor="imageUrl"
          hint="选填"
          error={state.fieldErrors?.imageUrl}
        >
          <Input
            id="imageUrl"
            name="imageUrl"
            type="url"
            placeholder="https://..."
            aria-invalid={(state.fieldErrors?.imageUrl?.length ?? 0) > 0 || undefined}
          />
        </FormField>
      </div>

      {state.message && !state.ok && <FormError message={state.message} />}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="reset"
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
          {pending ? "发布中…" : "发布帖子"}
        </button>
      </div>
    </form>
  );
}
