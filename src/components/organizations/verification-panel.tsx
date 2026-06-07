"use client";

import { useActionState } from "react";

import {
  ORG_VERIFICATION_STATUS_LABEL,
  type OrgVerificationStatusValue,
} from "@/lib/organizations/schemas";
import {
  cancelVerificationAction,
  submitVerificationAction,
  type OrgActionState,
} from "@/lib/organizations/server-actions";

interface Defaults {
  id: string;
  slug: string;
  status: OrgVerificationStatusValue;
  isVerified: boolean;
  name: string | null;
  regNo: string | null;
  rep: string | null;
  licenseUrl: string | null;
  contact: string | null;
  note: string | null;
  reviewNote: string | null;
  submittedAt: Date | string | null;
  reviewedAt: Date | string | null;
}

const INITIAL: OrgActionState = {};

export function VerificationPanel({ defaults }: { defaults: Defaults }) {
  const [state, action, pending] = useActionState(submitVerificationAction, INITIAL);

  const statusLabel = ORG_VERIFICATION_STATUS_LABEL[defaults.status];
  const canSubmit =
    defaults.status === "NONE" ||
    defaults.status === "REJECTED" ||
    defaults.status === "APPROVED"; // APPROVED 也可重新提交（资料变更）
  const isPending = defaults.status === "PENDING";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">认证状态</span>
          <span
            className={
              defaults.status === "APPROVED"
                ? "rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300"
                : defaults.status === "PENDING"
                  ? "rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-300"
                  : defaults.status === "REJECTED"
                    ? "rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-rose-300"
                    : "rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-muted-foreground"
            }
          >
            {statusLabel}
          </span>
          {defaults.isVerified && (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              ✔ 公开标识：已认证
            </span>
          )}
        </div>
        {isPending && (
          <form action={cancelVerificationAction}>
            <input type="hidden" name="id" value={defaults.id} />
            <input type="hidden" name="slug" value={defaults.slug} />
            <button
              className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              type="submit"
            >
              撤回申请
            </button>
          </form>
        )}
      </div>

      {defaults.status === "REJECTED" && defaults.reviewNote && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-200">
          <p className="font-medium">驳回原因</p>
          <p className="mt-1 text-rose-200/90">{defaults.reviewNote}</p>
        </div>
      )}

      {defaults.status === "PENDING" && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          申请已提交，请耐心等待管理员审核。
          {defaults.submittedAt && (
            <span className="ml-1 text-amber-200/70">
              提交于 {new Date(defaults.submittedAt).toISOString().slice(0, 10)}
            </span>
          )}
        </div>
      )}

      {defaults.status === "APPROVED" && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200">
          认证已通过。如企业资料发生变更，可重新提交资料触发再次审核。
        </div>
      )}

      <form action={action} className="space-y-3" key={defaults.status}>
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
          <Field
            label="营业执照上的企业名称"
            required
            error={state.fieldErrors?.name?.[0]}
          >
            <input
              name="name"
              defaultValue={defaults.name ?? ""}
              maxLength={120}
              required
              disabled={!canSubmit}
              className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm disabled:opacity-60 outline-none focus:border-primary/50"
            />
          </Field>

          <Field
            label="统一社会信用代码"
            required
            error={state.fieldErrors?.regNo?.[0]}
            hint="18 位代码或工商注册号（仅字母/数字）"
          >
            <input
              name="regNo"
              defaultValue={defaults.regNo ?? ""}
              minLength={8}
              maxLength={30}
              pattern="[A-Za-z0-9]{8,30}"
              required
              disabled={!canSubmit}
              className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm disabled:opacity-60 outline-none focus:border-primary/50"
            />
          </Field>

          <Field label="法定代表人" required error={state.fieldErrors?.rep?.[0]}>
            <input
              name="rep"
              defaultValue={defaults.rep ?? ""}
              maxLength={60}
              required
              disabled={!canSubmit}
              className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm disabled:opacity-60 outline-none focus:border-primary/50"
            />
          </Field>

          <Field label="联系电话 / 邮箱" required error={state.fieldErrors?.contact?.[0]}>
            <input
              name="contact"
              defaultValue={defaults.contact ?? ""}
              maxLength={120}
              required
              disabled={!canSubmit}
              className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm disabled:opacity-60 outline-none focus:border-primary/50"
            />
          </Field>

          <Field
            label="营业执照图片 URL"
            required
            error={state.fieldErrors?.licenseUrl?.[0]}
            hint="上传到 OSS / R2 后填写公开 URL；管理员会人工核对"
            className="sm:col-span-2"
          >
            <input
              name="licenseUrl"
              defaultValue={defaults.licenseUrl ?? ""}
              placeholder="https://..."
              required
              disabled={!canSubmit}
              className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-2 text-sm disabled:opacity-60 outline-none focus:border-primary/50"
            />
          </Field>

          <Field
            label="补充说明（可选）"
            error={state.fieldErrors?.note?.[0]}
            className="sm:col-span-2"
          >
            <textarea
              name="note"
              defaultValue={defaults.note ?? ""}
              rows={3}
              maxLength={500}
              disabled={!canSubmit}
              placeholder="例如：企业近期更名 / 营业范围调整 / 证件号变更原因..."
              className="w-full rounded-md border border-border/60 bg-background/40 px-2 py-1.5 text-sm disabled:opacity-60 outline-none focus:border-primary/50"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
          <p className="text-[11px] text-muted-foreground">
            提交资料将进入人工审核；每小时最多提交 5 次。
          </p>
          <button
            type="submit"
            disabled={pending || !canSubmit}
            className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
          >
            {pending
              ? "提交中…"
              : defaults.status === "APPROVED"
                ? "重新提交资料"
                : defaults.status === "REJECTED"
                  ? "重新提交"
                  : "提交认证"}
          </button>
        </div>
      </form>
    </div>
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
