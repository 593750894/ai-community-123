"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Film,
  ImageIcon,
  Loader2,
  Upload,
  X,
} from "lucide-react";

import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_VIDEO_MIME,
  getMaxSize,
  UPLOAD_KIND,
  type UploadKind,
} from "@/lib/uploads/config";
import { uploadFile, UploadClientError } from "@/lib/uploads/client";
import { cn } from "@/lib/utils";

type Status = "idle" | "uploading" | "done" | "error";

export interface MediaUploaderProps {
  kind: UploadKind;
  name: string;
  /** 已有值（编辑场景兼容老的 URL 输入） */
  defaultValue?: string;
  /** 上传成功 / 清除时通知父组件，便于做表单联动 */
  onChange?: (publicUrl: string | null) => void;
  /** 上传状态变化时通知父组件，便于阻止表单在上传中提交 */
  onStatusChange?: (status: "idle" | "uploading" | "done" | "error") => void;
  label?: string;
  hint?: string;
  className?: string;
  /** 是否在已有 URL 时也展示 "改用 URL" 备用输入 */
  allowUrlFallback?: boolean;
}

function acceptValue(kind: UploadKind): string {
  return Object.keys(
    kind === UPLOAD_KIND.IMAGE ? ALLOWED_IMAGE_MIME : ALLOWED_VIDEO_MIME,
  ).join(",");
}

function readableMaxSize(kind: UploadKind): string {
  return `${Math.round(getMaxSize(kind) / 1024 / 1024)}MB`;
}

export function MediaUploader({
  kind,
  name,
  defaultValue,
  onChange,
  onStatusChange,
  label,
  hint,
  className,
  allowUrlFallback = true,
}: MediaUploaderProps) {
  const [url, setUrl] = useState<string>(defaultValue ?? "");
  const [status, setStatus] = useState<Status>(
    defaultValue ? "done" : "idle",
  );
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  function applyUrl(next: string) {
    setUrl(next);
    onChange?.(next || null);
  }

  async function startUpload(file: File) {
    setPickedFile(file);
    setStatus("uploading");
    setProgress(0);
    setError(null);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await uploadFile({
        kind,
        file,
        onProgress: setProgress,
        signal: ac.signal,
      });
      applyUrl(res.publicUrl);
      setStatus("done");
    } catch (err) {
      if (err instanceof UploadClientError && err.code === "ABORTED") {
        setStatus("idle");
        setProgress(0);
        return;
      }
      const msg =
        err instanceof Error ? err.message : "上传失败，请稍后重试";
      setError(msg);
      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  }

  function pickFile() {
    inputRef.current?.click();
  }

  function reset() {
    abortRef.current?.abort();
    setStatus("idle");
    setProgress(0);
    setPickedFile(null);
    setError(null);
    applyUrl("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function retry() {
    if (pickedFile) {
      void startUpload(pickedFile);
    } else {
      pickFile();
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void startUpload(file);
  }

  const isImage = kind === UPLOAD_KIND.IMAGE;
  const Icon = isImage ? ImageIcon : Film;
  const kindLabel = isImage ? "图片" : "视频";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground/90">
            {label}
          </span>
          {allowUrlFallback && (
            <button
              type="button"
              onClick={() => setUrlMode((v) => !v)}
              className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {urlMode ? "改用上传" : "粘贴链接"}
            </button>
          )}
        </div>
      )}

      {/* 隐藏的真实表单字段：始终是 URL，提交时被服务端 action 读取 */}
      <input type="hidden" name={name} value={url} />

      {urlMode ? (
        <input
          type="url"
          value={url}
          onChange={(e) => applyUrl(e.target.value)}
          placeholder="https://..."
          className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none transition-colors focus:border-primary/50"
        />
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "group relative flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-card/30 px-4 py-6 text-center transition-colors",
            dragOver && "border-primary/50 bg-primary/5",
            status === "error" && "border-destructive/50 bg-destructive/5",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={acceptValue(kind)}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void startUpload(file);
            }}
          />

          {status === "done" && url ? (
            <PreviewCard
              kind={kind}
              url={url}
              onRemove={reset}
              onReplace={pickFile}
            />
          ) : status === "uploading" ? (
            <div className="flex w-full flex-col items-center gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              <div className="text-xs text-muted-foreground">
                正在上传 {pickedFile?.name ?? ""} · {progress}%
              </div>
              <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                取消
              </button>
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="size-5 text-destructive" />
              <div className="text-xs text-destructive">{error}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-md border border-border/60 bg-background px-3 py-1 text-xs hover:bg-muted"
                >
                  重试
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={pickFile}
              className="flex flex-col items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <span className="text-sm">
                <span className="text-foreground">点击选择</span>{" "}
                或拖拽{kindLabel}到这里
              </span>
              <span className="text-[11px] text-muted-foreground">
                {Object.keys(
                  isImage ? ALLOWED_IMAGE_MIME : ALLOWED_VIDEO_MIME,
                )
                  .map((m) => m.split("/")[1].toUpperCase())
                  .join(" / ")}{" "}
                · 最大 {readableMaxSize(kind)}
              </span>
            </button>
          )}
        </div>
      )}

      {hint && (
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function PreviewCard({
  kind,
  url,
  onRemove,
  onReplace,
}: {
  kind: UploadKind;
  url: string;
  onRemove: () => void;
  onReplace: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-3">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/40 text-muted-foreground">
        {kind === UPLOAD_KIND.IMAGE ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="预览"
            className="size-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Film className="size-5" />
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-xs text-foreground/90">{url}</div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={onReplace}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Upload className="size-3" />
            替换
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
          >
            <X className="size-3" />
            移除
          </button>
        </div>
      </div>
    </div>
  );
}
