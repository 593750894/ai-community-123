"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";

import {
  sendMessageAction,
  type SendMessageFormState,
} from "@/lib/messages/actions";

const initial: SendMessageFormState = {};

export function MessageComposer({
  conversationId,
}: {
  conversationId: string;
}) {
  const [state, action, pending] = useActionState(sendMessageAction, initial);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (state.ok && textareaRef.current) {
      textareaRef.current.value = "";
    }
  }, [state.ok, state.resetKey]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 发送，Shift+Enter 换行
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!pending) {
        formRef.current?.requestSubmit();
      }
    }
  }

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="flex items-end gap-2 rounded-xl border border-border/60 bg-card/40 p-2 focus-within:border-primary/50">
        <textarea
          ref={textareaRef}
          name="content"
          required
          rows={2}
          maxLength={4000}
          placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="size-3.5" />
          {pending ? "发送中…" : "发送"}
        </button>
      </div>
      {state.fieldErrors?.content?.[0] && (
        <p className="text-xs text-destructive">
          {state.fieldErrors.content[0]}
        </p>
      )}
      {state.message && !state.ok && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
