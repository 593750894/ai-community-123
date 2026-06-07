"use client";

import { useActionState } from "react";

import { FormError, FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  GROUP_TITLE_MAX,
  GROUP_TITLE_MIN,
} from "@/lib/messages/schemas";
import {
  updateGroupConversationAction,
  type GroupFormState,
} from "@/lib/messages/group-actions";

const initial: GroupFormState = {};

export function GroupSettingsForm({
  conversationId,
  initialTitle,
  initialAvatarUrl,
  readOnly,
}: {
  conversationId: string;
  initialTitle: string;
  initialAvatarUrl: string | null;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateGroupConversationAction,
    initial,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="conversationId" value={conversationId} />
      <FormField
        label="群名"
        htmlFor="group-title"
        required
        error={state.fieldErrors?.title}
      >
        <Input
          id="group-title"
          name="title"
          defaultValue={initialTitle}
          minLength={GROUP_TITLE_MIN}
          maxLength={GROUP_TITLE_MAX}
          required
          disabled={readOnly}
        />
      </FormField>
      <FormField
        label="群头像 URL"
        htmlFor="group-avatar"
        hint="留空则使用默认占位"
        error={state.fieldErrors?.avatarUrl}
      >
        <Input
          id="group-avatar"
          name="avatarUrl"
          type="url"
          defaultValue={initialAvatarUrl ?? ""}
          disabled={readOnly}
        />
      </FormField>
      {state.message && state.ok && (
        <p
          role="status"
          className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
        >
          {state.message}
        </p>
      )}
      <FormError message={state.ok ? null : state.message ?? null} />
      {!readOnly && (
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "保存中…" : "保存修改"}
        </button>
      )}
    </form>
  );
}
