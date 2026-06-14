"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";

import { MessageAttachments } from "@/components/messages/message-attachments";
import {
  MESSAGE_CONTENT_MAX,
  MESSAGE_EDIT_WINDOW_MS,
  MESSAGE_RECALL_WINDOW_MS,
} from "@/lib/messages/schemas";
import type {
  ConversationRole,
  ConversationUser,
  MessageAttachment,
} from "@/lib/messages/queries";

const TIME_FMT = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
});

export type MessageBubbleProps = {
  conversationId: string;
  messageId: string;
  senderId: string;
  content: string;
  type: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
  attachments: MessageAttachment[] | null;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  self: boolean;
  sender: ConversationUser | null;
  isGroup: boolean;
  viewerRole: ConversationRole;
  /** 群聊 sender 的角色，决定 admin 是否能强删；undefined = 未知，按 MEMBER 处理。 */
  senderRole?: ConversationRole;
};

/**
 * Stage 12.4：单条消息气泡（客户端组件）。
 * - 软删除：渲染「该消息已撤回」placeholder。
 * - 自己的消息：hover 显示「编辑 / 撤回」按钮；编辑窗口期内才显示编辑入口。
 * - 群主 / 管理员可对低权限成员的消息显示「删除」按钮（无时间限制）。
 * - @username 解析并高亮显示。
 */
export function MessageBubble({
  conversationId,
  messageId,
  senderId,
  content,
  type,
  attachments,
  createdAt,
  editedAt,
  deletedAt,
  self,
  sender,
  isGroup,
  viewerRole,
  senderRole,
}: MessageBubbleProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSystem = type === "SYSTEM";
  const isDeleted = deletedAt != null;
  const isText = type === "TEXT";

  // 取 mount 时刻的时间戳；编辑/撤回窗口很短（2-15 分钟），不需要随时间动态更新——
  // 即使用户挂着页面超时，下一次点击会被服务端 403 兜底。
  const [mountedAt] = useState(() => Date.now());
  const age = mountedAt - createdAt.getTime();
  const canEdit = self && isText && !isDeleted && age <= MESSAGE_EDIT_WINDOW_MS;
  const senderRoleSafe = senderRole ?? "MEMBER";
  const canRecallSelf = self && !isDeleted && age <= MESSAGE_RECALL_WINDOW_MS && !isSystem;
  const canForceDelete =
    !self &&
    !isSystem &&
    !isDeleted &&
    isGroup &&
    (viewerRole === "OWNER" ||
      (viewerRole === "ADMIN" && senderRoleSafe === "MEMBER")) &&
    senderRoleSafe !== "OWNER";
  const canDelete = canRecallSelf || canForceDelete;

  // 编辑 textarea 自动聚焦
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(draft.length, draft.length);
    }
  }, [isEditing, draft.length]);

  // SYSTEM 消息：胶囊样式，永远居中
  if (isSystem) {
    return (
      <div className="mx-auto max-w-md rounded-full border border-border bg-muted/30 px-3 py-1 text-center text-[11px] text-muted-foreground">
        {content || "系统消息"}
      </div>
    );
  }

  // 已撤回：替换为 placeholder 胶囊
  if (isDeleted) {
    return (
      <div
        className={`flex gap-2 ${self ? "justify-end" : "justify-start"} text-[11px] text-muted-foreground`}
      >
        <span className="rounded-full border border-dashed border-border bg-muted/20 px-3 py-1">
          {self ? "你撤回了一条消息" : `${sender?.name ?? "对方"} 撤回了一条消息`}
        </span>
      </div>
    );
  }

  async function submitEdit() {
    const next = draft.trim();
    if (next === content.trim()) {
      setIsEditing(false);
      setErrorMsg(null);
      return;
    }
    if (next.length === 0) {
      setErrorMsg("编辑后的内容不能为空");
      return;
    }
    if (next.length > MESSAGE_CONTENT_MAX) {
      setErrorMsg(`消息最多 ${MESSAGE_CONTENT_MAX} 个字符`);
      return;
    }
    setPending(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages/${messageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: next }),
        },
      );
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.success) {
        setErrorMsg(json?.error?.message ?? `编辑失败 (${res.status})`);
        return;
      }
      setIsEditing(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function submitDelete() {
    if (!window.confirm(self ? "确认撤回这条消息？" : "确认删除这条消息？")) return;
    setPending(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages/${messageId}`,
        { method: "DELETE" },
      );
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok || !json?.success) {
        setErrorMsg(json?.error?.message ?? `撤回失败 (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  return (
    <div
      className={`group flex gap-2 ${self ? "justify-end" : "justify-start"}`}
      data-message-id={messageId}
      data-sender-id={senderId}
    >
      {!self &&
        (sender?.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sender.avatar}
            alt={sender.name}
            className="size-7 shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
            {sender?.name?.slice(0, 1) ?? "?"}
          </span>
        ))}
      <div className="flex max-w-md flex-col">
        <div
          className={`flex flex-col gap-2 break-words rounded-2xl px-3 py-2 text-sm ${
            self
              ? "rounded-tr-sm bg-primary text-primary-foreground"
              : "rounded-tl-sm bg-card/70 text-foreground/95"
          }`}
        >
          {!self && isGroup && sender && (
            <div className="text-[10px] font-medium text-primary/80">
              {sender.name}
            </div>
          )}

          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                ref={ref}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={MESSAGE_CONTENT_MAX}
                disabled={pending}
                className="w-full resize-y rounded-md border border-primary-foreground/30 bg-background/30 px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsEditing(false);
                    setDraft(content);
                    setErrorMsg(null);
                  }
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void submitEdit();
                  }
                }}
              />
              {errorMsg && (
                <div className="text-[11px] text-destructive">{errorMsg}</div>
              )}
              <div className="flex items-center justify-end gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setDraft(content);
                    setErrorMsg(null);
                  }}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card/30 px-2 py-1 hover:bg-card/60 disabled:opacity-60"
                >
                  <X className="size-3" /> 取消
                </button>
                <button
                  type="button"
                  onClick={() => void submitEdit()}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  <Check className="size-3" /> 保存
                </button>
              </div>
            </div>
          ) : (
            <>
              {content && (
                <div className="whitespace-pre-wrap">
                  <MessageContent text={content} />
                </div>
              )}
              {hasAttachments && (
                <MessageAttachments attachments={attachments!} self={self} />
              )}
            </>
          )}

          <div
            className={`flex items-center gap-1.5 text-[10px] ${
              self ? "text-primary-foreground/70" : "text-muted-foreground"
            }`}
          >
            <span>{TIME_FMT.format(createdAt)}</span>
            {editedAt && <span className="opacity-70">(已编辑)</span>}
            {!isEditing && (canEdit || canDelete) && (
              <span className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(content);
                      setErrorMsg(null);
                      setIsEditing(true);
                    }}
                    disabled={pending}
                    className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-black/10"
                    title="编辑（仅 15 分钟内）"
                  >
                    <Pencil className="size-3" />
                    编辑
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void submitDelete()}
                    disabled={pending}
                    className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 hover:bg-destructive/20"
                    title={canRecallSelf ? "撤回（仅 2 分钟内）" : "删除该消息"}
                  >
                    <Trash2 className="size-3" />
                    {canRecallSelf ? "撤回" : "删除"}
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
        {errorMsg && !isEditing && (
          <div className="mt-1 text-[10px] text-destructive">{errorMsg}</div>
        )}
      </div>
    </div>
  );
}

/** 将 @username 渲染为蓝色高亮（链接到 /u/<name>）；其他文本原样输出。 */
function MessageContent({ text }: { text: string }) {
  // 与 lifecycle.ts MENTION_RE 同源；这里允许行首
  const RE = /(^|[^A-Za-z0-9_@])@([A-Za-z0-9_-]{1,64})/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  for (const match of text.matchAll(RE)) {
    const start = match.index ?? 0;
    const lead = match[1] ?? "";
    const username = match[2];
    const before = text.slice(lastIdx, start) + lead;
    if (before) parts.push(<span key={`t-${key++}`}>{before}</span>);
    parts.push(
      <a
        key={`m-${key++}`}
        href={`/u/${username}`}
        className="font-medium text-tag-blue-fg hover:underline"
      >
        @{username}
      </a>,
    );
    lastIdx = start + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(<span key={`t-${key++}`}>{text.slice(lastIdx)}</span>);
  }
  return <>{parts}</>;
}
