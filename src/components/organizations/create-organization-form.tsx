"use client";

import { useActionState } from "react";

import {
  ORG_INDUSTRIES,
  ORG_INDUSTRY_LABEL,
  ORG_SIZES,
} from "@/lib/organizations/schemas";
import {
  createOrganizationAction,
  type OrgActionState,
} from "@/lib/organizations/server-actions";

const INITIAL: OrgActionState = {};

export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(createOrganizationAction, INITIAL);

  return (
    <form action={action} className="space-y-4">
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
          label="企业名称"
          required
          error={state.fieldErrors?.name?.[0]}
          hint="将作为公开企业账号的展示名"
        >
          <input
            name="name"
            placeholder="例如：星辰影业"
            maxLength={80}
            required
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>

        <Field
          label="slug（URL 标识）"
          required
          error={state.fieldErrors?.slug?.[0]}
          hint="3-64 位小写字母 / 数字 / 连字符，首尾非连字符；创建后不可改"
        >
          <input
            name="slug"
            placeholder="xingchen-studio"
            pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]"
            minLength={3}
            maxLength={64}
            required
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>

        <Field
          label="简介"
          error={state.fieldErrors?.description?.[0]}
          className="sm:col-span-2"
        >
          <textarea
            name="description"
            rows={3}
            maxLength={500}
            placeholder="一句话介绍企业方向、代表作品或服务"
            className="w-full rounded-md border border-border bg-background/40 px-2 py-1.5 text-sm outline-none focus:border-primary/50"
          />
        </Field>

        <Field label="Logo URL" error={state.fieldErrors?.logo?.[0]}>
          <input
            name="logo"
            placeholder="https://..."
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>

        <Field label="官网" error={state.fieldErrors?.website?.[0]}>
          <input
            name="website"
            placeholder="https://your.company"
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>

        <Field label="行业">
          <select
            name="industry"
            defaultValue=""
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          >
            <option value="">未指定</option>
            {ORG_INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {ORG_INDUSTRY_LABEL[ind]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="团队规模">
          <select
            name="size"
            defaultValue=""
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          >
            <option value="">未指定</option>
            {ORG_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="联系邮箱"
          error={state.fieldErrors?.contactEmail?.[0]}
          className="sm:col-span-2"
        >
          <input
            name="contactEmail"
            type="email"
            placeholder="hr@company.com"
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-[11px] text-muted-foreground">
          创建后你自动成为该企业的所有者。每小时最多创建 5 个。
        </p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
        >
          {pending ? "创建中…" : "创建企业"}
        </button>
      </div>
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
