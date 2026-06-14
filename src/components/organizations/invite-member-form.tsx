"use client";

import { useActionState } from "react";

import {
  inviteMemberAction,
  type OrgActionState,
} from "@/lib/organizations/server-actions";

const INITIAL: OrgActionState = {};

export function InviteMemberForm({ orgId, slug }: { orgId: string; slug: string }) {
  const [state, action, pending] = useActionState(inviteMemberAction, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={orgId} />
      <input type="hidden" name="slug" value={slug} />

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
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">
            用户名
          </label>
          <input
            name="inviteeUsername"
            placeholder="对方的 @用户名（不含 @）"
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
            maxLength={64}
            required
          />
          {state.fieldErrors?.inviteeUsername?.[0] && (
            <p className="mt-1 text-[11px] text-rose-400">
              {state.fieldErrors.inviteeUsername[0]}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">
            角色
          </label>
          <select
            name="role"
            defaultValue="MEMBER"
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
          >
            <option value="MEMBER">成员</option>
            <option value="ADMIN">管理员</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] text-muted-foreground">
            备注（可选）
          </label>
          <input
            name="message"
            placeholder="可留一句邀请理由，对方会在通知中看到"
            className="h-9 w-full rounded-md border border-border bg-background/40 px-2 text-sm outline-none focus:border-primary/50"
            maxLength={200}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
        >
          {pending ? "发送中…" : "发送邀请"}
        </button>
      </div>
    </form>
  );
}
