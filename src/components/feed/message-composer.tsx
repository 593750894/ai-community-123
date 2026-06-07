"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Loader2,
  Music,
  Paperclip,
  Send,
  Video,
  X,
} from "lucide-react";

import {
  sendMessageAction,
  type SendMessageFormState,
} from "@/lib/messages/actions";
import {
  ALLOWED_MESSAGE_ATTACHMENT_MIME,
  categorizeAttachment,
  MAX_MESSAGE_ATTACHMENT_SIZE,
  UPLOAD_KIND,
  type AttachmentCategory,
} from "@/lib/uploads/config";
import {
  precheckFile,
  uploadFile,
  UploadClientError,
} from "@/lib/uploads/client";
import { MESSAGE_ATTACHMENT_MAX_COUNT } from "@/lib/messages/schemas";
import { cn } from "@/lib/utils";

const initial: SendMessageFormState = {};

const ACCEPT = Object.keys(ALLOWED_MESSAGE_ATTACHMENT_MIME).join(",");

type AttachmentDraft = {
  /** 客户端 UUID，用于 React key + 上传中删除。 */
  id: string;
  file: File;
  /** 本地预览 URL（仅 image）；其它类型为 null。 */
  previewUrl: string | null;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
  publicUrl?: string;
  /** 仅 image：实测 naturalWidth / Height。 */
  width?: number;
  height?: number;
  abort: AbortController;
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function CategoryIcon({
  cat,
  className,
}: {
  cat: AttachmentCategory;
  className?: string;
}) {
  if (cat === "image") return <ImageIcon className={className} />;
  if (cat === "video") return <Video className={className} />;
  if (cat === "audio") return <Music className={className} />;
  return <FileText className={className} />;
}

export function MessageComposer({
  conversationId,
}: {
  conversationId: string;
}) {
  const [state, action, pending] = useActionState(sendMessageAction, initial);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [drafts, setDrafts] = useState<AttachmentDraft[]>([]);
  const draftsRef = useRef<AttachmentDraft[]>([]);
  draftsRef.current = drafts;
  const [dragOver, setDragOver] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  // 仅用于附件序列化到隐藏 input 的最终 publicUrl 集合。
  const uploadedAttachments = useMemo(() => {
    return drafts
      .filter((d) => d.status === "done" && d.publicUrl)
      .map((d) => ({
        url: d.publicUrl!,
        name: d.file.name,
        mimeType: d.file.type,
        sizeBytes: d.file.size,
        ...(d.width ? { width: d.width } : {}),
        ...(d.height ? { height: d.height } : {}),
      }));
  }, [drafts]);

  const hasUploadingAttachment = drafts.some((d) => d.status === "uploading");

  // 成功后清空 textarea + 附件 + 释放 object URL。
  useEffect(() => {
    if (state.ok) {
      if (textareaRef.current) textareaRef.current.value = "";
      setDrafts((prev) => {
        prev.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl));
        return [];
      });
      setPickError(null);
    }
  }, [state.ok, state.resetKey]);

  // 卸载时释放所有 object URL + 中止上传。读 ref 而非 state，避免在 unmount 时调用 setState。
  useEffect(() => {
    return () => {
      for (const d of draftsRef.current) {
        d.abort.abort();
        if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
      }
    };
  }, []);

  const startUpload = useCallback((draft: AttachmentDraft) => {
    void (async () => {
      try {
        const res = await uploadFile({
          kind: UPLOAD_KIND.MESSAGE_ATTACHMENT,
          file: draft.file,
          signal: draft.abort.signal,
          onProgress: (p) =>
            setDrafts((prev) =>
              prev.map((d) => (d.id === draft.id ? { ...d, progress: p } : d)),
            ),
        });
        setDrafts((prev) =>
          prev.map((d) =>
            d.id === draft.id
              ? { ...d, status: "done", progress: 100, publicUrl: res.publicUrl }
              : d,
          ),
        );
      } catch (err) {
        if (
          err instanceof UploadClientError &&
          err.code === "ABORTED"
        ) {
          return;
        }
        const msg =
          err instanceof Error ? err.message : "上传失败，请稍后重试";
        setDrafts((prev) =>
          prev.map((d) =>
            d.id === draft.id ? { ...d, status: "error", error: msg } : d,
          ),
        );
      }
    })();
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      setPickError(null);
      setDrafts((prev) => {
        const remaining = MESSAGE_ATTACHMENT_MAX_COUNT - prev.length;
        if (remaining <= 0) {
          setPickError(`最多 ${MESSAGE_ATTACHMENT_MAX_COUNT} 个附件`);
          return prev;
        }
        const accepted = files.slice(0, remaining);
        const rejectedCount = files.length - accepted.length;
        if (rejectedCount > 0) {
          setPickError(`已忽略 ${rejectedCount} 个超额附件`);
        }
        const created: AttachmentDraft[] = [];
        for (const file of accepted) {
          const err = precheckFile(UPLOAD_KIND.MESSAGE_ATTACHMENT, file);
          if (err) {
            setPickError(err);
            continue;
          }
          const cat = categorizeAttachment(file.type);
          const previewUrl =
            cat === "image" ? URL.createObjectURL(file) : null;
          const draft: AttachmentDraft = {
            id: uid(),
            file,
            previewUrl,
            status: "uploading",
            progress: 0,
            abort: new AbortController(),
          };
          // 异步读取图片尺寸（不阻塞上传）
          if (cat === "image" && previewUrl) {
            const img = new Image();
            img.onload = () => {
              setDrafts((cur) =>
                cur.map((d) =>
                  d.id === draft.id
                    ? {
                        ...d,
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                      }
                    : d,
                ),
              );
            };
            img.src = previewUrl;
          }
          created.push(draft);
        }
        created.forEach(startUpload);
        return [...prev, ...created];
      });
    },
    [startUpload],
  );

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    addFiles(files);
    // 允许选同一个文件再次触发 onChange
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeDraft(id: string) {
    setDrafts((prev) => {
      const target = prev.find((d) => d.id === id);
      if (target) {
        target.abort.abort();
        if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((d) => d.id !== id);
    });
  }

  function handleDrop(e: React.DragEvent<HTMLFormElement>) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.size > 0);
    if (files.length > 0) addFiles(files);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!pending && !hasUploadingAttachment) {
        formRef.current?.requestSubmit();
      }
    }
  }

  const draftCount = drafts.length;

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-2"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        // 仅在离开 form 外层时清除高亮
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={handleDrop}
    >
      <input type="hidden" name="conversationId" value={conversationId} />
      <input
        type="hidden"
        name="attachments"
        value={JSON.stringify(uploadedAttachments)}
      />

      {drafts.length > 0 && (
        <ul className="flex flex-wrap gap-2 rounded-xl border border-border/60 bg-card/40 p-2">
          {drafts.map((d) => {
            const cat = categorizeAttachment(d.file.type);
            return (
              <li
                key={d.id}
                className={cn(
                  "relative flex w-40 shrink-0 flex-col gap-1 rounded-lg border border-border/60 bg-card/60 p-2 text-xs",
                  d.status === "error" && "border-destructive/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => removeDraft(d.id)}
                  className="absolute right-1 top-1 z-10 inline-flex size-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground"
                  aria-label="移除附件"
                >
                  <X className="size-3" />
                </button>
                <div className="flex h-20 items-center justify-center overflow-hidden rounded-md bg-muted/40">
                  {cat === "image" && d.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.previewUrl}
                      alt={d.file.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <CategoryIcon
                      cat={cat}
                      className="size-7 text-muted-foreground"
                    />
                  )}
                  {d.status === "uploading" && (
                    <div className="absolute inset-x-2 bottom-2 flex items-center gap-1 text-[10px] text-primary-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      {d.progress}%
                    </div>
                  )}
                </div>
                <div className="line-clamp-1 text-foreground/90" title={d.file.name}>
                  {d.file.name}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{formatBytes(d.file.size)}</span>
                  {d.status === "done" && (
                    <span className="text-emerald-400">已就绪</span>
                  )}
                  {d.status === "uploading" && (
                    <span className="text-primary">{d.progress}%</span>
                  )}
                  {d.status === "error" && (
                    <span className="text-destructive">失败</span>
                  )}
                </div>
                {d.error && (
                  <p className="line-clamp-2 text-[10px] text-destructive">
                    {d.error}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div
        className={cn(
          "flex items-end gap-2 rounded-xl border border-border/60 bg-card/40 p-2 transition-colors focus-within:border-primary/50",
          dragOver && "border-primary bg-primary/5",
        )}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          aria-label="添加附件"
          title={`添加附件（最多 ${MESSAGE_ATTACHMENT_MAX_COUNT} 个，单文件 ${Math.round(MAX_MESSAGE_ATTACHMENT_SIZE / 1024 / 1024)}MB 上限）`}
        >
          <Paperclip className="size-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={handleFileInput}
        />
        <textarea
          ref={textareaRef}
          name="content"
          rows={2}
          maxLength={4000}
          placeholder={
            dragOver
              ? "释放鼠标即可添加附件"
              : "输入消息或拖拽 / 粘贴文件… (Enter 发送，Shift+Enter 换行)"
          }
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={pending || hasUploadingAttachment}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending || hasUploadingAttachment ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          {pending
            ? "发送中…"
            : hasUploadingAttachment
              ? "上传中…"
              : "发送"}
        </button>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          {draftCount > 0
            ? `${draftCount} / ${MESSAGE_ATTACHMENT_MAX_COUNT} 附件`
            : `支持图片 / 视频 / 音频 / PDF / ZIP，单文件 ${Math.round(MAX_MESSAGE_ATTACHMENT_SIZE / 1024 / 1024)}MB`}
        </span>
      </div>

      {pickError && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3.5" />
          {pickError}
        </p>
      )}
      {state.fieldErrors?.content?.[0] && (
        <p className="text-xs text-destructive">
          {state.fieldErrors.content[0]}
        </p>
      )}
      {state.fieldErrors?.attachments?.[0] && (
        <p className="text-xs text-destructive">
          {state.fieldErrors.attachments[0]}
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
