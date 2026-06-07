"use client";

import { useActionState } from "react";
import { Users } from "lucide-react";

import { FormError, FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  GROUP_CREATE_MIN_INVITES,
  GROUP_TITLE_MAX,
  GROUP_TITLE_MIN,
} from "@/lib/messages/schemas";
import {
  createGroupConversationAction,
  type GroupFormState,
} from "@/lib/messages/group-actions";

const initial: GroupFormState = {};

export function CreateGroupForm() {
  const [state, action, pending] = useActionState(
    createGroupConversationAction,
    initial,
  );

  return (
    <form action={action} className="space-y-5">
      <FormField
        label="群名"
        htmlFor="group-title"
        required
        hint={`${GROUP_TITLE_MIN}-${GROUP_TITLE_MAX} 个字符`}
        error={state.fieldErrors?.title}
      >
        <Input
          id="group-title"
          name="title"
          maxLength={GROUP_TITLE_MAX}
          required
          placeholder="例如：MidJourney 创作交流"
        />
      </FormField>
      <FormField
        label="群头像 URL（可选）"
        htmlFor="group-avatar"
        hint="留空使用默认占位"
        error={state.fieldErrors?.avatarUrl}
      >
        <Input
          id="group-avatar"
          name="avatarUrl"
          type="url"
          placeholder="https://..."
        />
      </FormField>
      <FormField
        label="成员"
        htmlFor="group-members"
        required
        hint={`输入对方用户名，多人请用换行 / 逗号分隔（至少 ${GROUP_CREATE_MIN_INVITES} 人）`}
        error={
          state.fieldErrors?.memberIds ||
          state.fieldErrors?.members ||
          undefined
        }
      >
        <textarea
          id="group-members"
          name="members"
          required
          rows={4}
          placeholder="@alice&#10;@bob"
          className="block w-full resize-y rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/60"
        />
      </FormField>
      <FormError message={state.ok ? null : state.message ?? null} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Users className="size-4" />
        {pending ? "创建中…" : "创建群聊"}
      </button>
    </form>
  );
}
