"use client";

import { useActionState } from "react";

import {
  ORG_INDUSTRIES,
  ORG_INDUSTRY_LABEL,
  ORG_SIZES,
  type OrgIndustry,
  type OrgSize,
} from "@/lib/organizations/schemas";
import {
  updateOrganizationAction,
  type OrgActionState,
} from "@/lib/organizations/server-actions";

interface Defaults {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo: string | null;
  website: string | null;
  industry: string | null;
  size: string | null;
  contactEmail: string | null;
}

const INITIAL: OrgActionState = {};

export function OrganizationSettingsForm({ defaults }: { defaults: Defaults }) {
  const [state, action, pending] = useActionState(updateOrganizationAction, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={defaults.id} />
      <input type="hidden" name="slug" value={defaults.slug} />

      {state.message && (
        <div
          className={
            state.ok
              ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
              : "rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
          }
        >
          {state.message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="名称" required error={state.fieldErrors?.name?.[0]}>
          <input
            name="name"
            defaultValue={defaults.name}
            maxLength={80}
            required
            className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>

        <Field label="slug（不可改）">
          <input
            value={defaults.slug}
            readOnly
            disabled
            className="h-9 w-full rounded-md border border-border/60 bg-background/30 px-2 text-sm text-muted-foreground"
          />
        </Field>

        <Field
          label="简介"
          error={state.fieldErrors?.description?.[0]}
          className="sm:col-span-2"
        >
          <textarea
            name="description"
            defaultValue={defaults.description ?? ""}
            rows={3}
            maxLength={500}
            className="w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm outline-none focus:border-primary/50"
          />
        </Field>

        <Field label="Logo URL" error={state.fieldErrors?.logo?.[0]}>
          <input
            name="logo"
            defaultValue={defaults.logo ?? ""}
            placeholder="https://..."
            className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>

        <Field label="官网" error={state.fieldErrors?.website?.[0]}>
          <input
            name="website"
            defaultValue={defaults.website ?? ""}
            placeholder="https://your.company"
            className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>

        <Field label="行业">
          <select
            name="industry"
            defaultValue={(defaults.industry as OrgIndustry) ?? ""}
            className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
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
            defaultValue={(defaults.size as OrgSize) ?? ""}
            className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
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
            defaultValue={defaults.contactEmail ?? ""}
            placeholder="hr@company.com"
            className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t border-border/40 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
        >
          {pending ? "保存中…" : "保存修改"}
        </button>
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
