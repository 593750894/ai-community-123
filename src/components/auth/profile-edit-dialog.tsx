"use client";

import { useActionState, useState } from "react";

import {
  updateProfileAction,
  type AuthFormState,
} from "@/lib/auth/actions";

const initial: AuthFormState = {};

type Initial = {
  name: string;
  avatar: string;
  bio: string;
  industryRole: string;
  expertise: string[];
  favoriteTools: string[];
  portfolioLinks: string[];
  contact: string;
};

export function ProfileEditDialog({
  initial: data,
  trigger,
}: {
  initial: Initial;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span onClick={() => setOpen(true)} className="inline-flex">
        {trigger}
      </span>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border/60 bg-card p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
              aria-label="关闭"
            >
              ✕
            </button>
            <h2 className="mb-4 text-lg font-semibold tracking-tight">
              编辑个人资料
            </h2>
            <ProfileEditForm initial={data} onSuccess={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

function ProfileEditForm({
  initial: data,
  onSuccess,
}: {
  initial: Initial;
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(
    updateProfileAction,
    initial,
  );

  if (state.ok && onSuccess) {
    // Fire-and-forget; React 19 useActionState will keep state.ok after re-render.
    setTimeout(onSuccess, 600);
  }

  return (
    <form action={action} className="space-y-4">
      <Field
        label="昵称"
        name="name"
        defaultValue={data.name}
        errors={state.fieldErrors?.name}
        required
      />
      <Field
        label="头像 URL"
        name="avatar"
        defaultValue={data.avatar}
        placeholder="https://..."
        errors={state.fieldErrors?.avatar}
      />
      <Textarea
        label="简介"
        name="bio"
        defaultValue={data.bio}
        placeholder="一段话介绍你自己，不超过 280 字。"
        errors={state.fieldErrors?.bio}
        rows={3}
      />
      <Field
        label="行业角色"
        name="industryRole"
        defaultValue={data.industryRole}
        placeholder="例如：导演 / 编剧 / 后期"
        errors={state.fieldErrors?.industryRole}
      />
      <Textarea
        label="擅长领域"
        name="expertise"
        defaultValue={data.expertise.join("\n")}
        placeholder={"每行一个，例如：\n短剧叙事\n赛博风格\n首尾帧控制"}
        errors={state.fieldErrors?.expertise}
        rows={3}
        hint="每行一个，最多 20 个"
      />
      <Textarea
        label="常用 AI 视频工具"
        name="favoriteTools"
        defaultValue={data.favoriteTools.join("\n")}
        placeholder={"每行一个，例如：\nSeedance 2.0\nRunway Gen-3\nSuno"}
        errors={state.fieldErrors?.favoriteTools}
        rows={3}
        hint="每行一个，最多 20 个"
      />
      <Textarea
        label="作品链接"
        name="portfolioLinks"
        defaultValue={data.portfolioLinks.join("\n")}
        placeholder={
          "每行一条 URL，例如：\nhttps://example.com/work-1\nhttps://example.com/work-2"
        }
        errors={state.fieldErrors?.portfolioLinks}
        rows={3}
        hint="每行一条 URL，最多 10 条"
      />
      <Field
        label="联系方式（可选）"
        name="contact"
        defaultValue={data.contact}
        placeholder="邮箱 / 微信 / Telegram 等"
        errors={state.fieldErrors?.contact}
      />

      {state.message && (
        <p
          className={
            state.ok
              ? "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500"
              : "rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          }
        >
          {state.message}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "保存中…" : "保存"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  errors,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  errors?: string[];
}) {
  const invalid = (errors?.length ?? 0) > 0;
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        aria-invalid={invalid || undefined}
        className="block h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20"
      />
      {errors?.map((msg) => (
        <p key={msg} className="text-xs text-destructive">
          {msg}
        </p>
      ))}
    </div>
  );
}

function Textarea({
  label,
  name,
  defaultValue,
  placeholder,
  rows = 3,
  errors,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
  errors?: string[];
  hint?: string;
}) {
  const invalid = (errors?.length ?? 0) > 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={name} className="text-sm font-medium">
          {label}
        </label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={rows}
        aria-invalid={invalid || undefined}
        className="block w-full resize-y rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20"
      />
      {errors?.map((msg) => (
        <p key={msg} className="text-xs text-destructive">
          {msg}
        </p>
      ))}
    </div>
  );
}
