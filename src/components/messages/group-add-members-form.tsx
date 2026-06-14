"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";

import { FormError, FormField } from "@/components/ui/field";
import {
  addGroupMembersAction,
  type GroupFormState,
} from "@/lib/messages/group-actions";

const initial: GroupFormState = {};

export function GroupAddMembersForm({
  conversationId,
}: {
  conversationId: string;
}) {
  const [state, action, pending] = useActionState(
    addGroupMembersAction,
    initial,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <FormField
        label="添加成员"
        htmlFor="add-members"
        hint="输入对方用户名，可用换行 / 逗号批量添加"
        error={
          state.fieldErrors?.memberIds ||
          state.fieldErrors?.members ||
          undefined
        }
      >
        <textarea
          id="add-members"
          name="members"
          required
          rows={3}
          placeholder="@charlie&#10;@diana"
          className="block w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
        />
      </FormField>
      {state.message && state.ok && (
        <p
          role="status"
          className="rounded-md border border-emerald-400/30 bg-tag-emerald-bg/10 px-3 py-2 text-xs text-tag-emerald-fg"
        >
          {state.message}
        </p>
      )}
      <FormError message={state.ok ? null : state.message ?? null} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <UserPlus className="size-4" />
        {pending ? "添加中…" : "添加成员"}
      </button>
    </form>
  );
}
