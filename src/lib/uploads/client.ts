import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_VIDEO_MIME,
  getMaxSize,
  isImageMime,
  isVideoMime,
  UPLOAD_KIND,
  type UploadKind,
} from "./config";

export interface UploadOptions {
  kind: UploadKind;
  file: File;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
}

export interface UploadResult {
  publicUrl: string;
  objectKey: string;
}

export class UploadClientError extends Error {
  code: string;
  constructor(message: string, code = "UPLOAD_FAILED") {
    super(message);
    this.code = code;
  }
}

interface SignResponse {
  success: boolean;
  data?: {
    uploadUrl: string;
    publicUrl: string;
    objectKey: string;
    headers: Record<string, string>;
    expiresAt: number;
  };
  error?: { code: string; message: string; details?: unknown };
}

/** 在选文件后立即做客户端检查，省一次往返。 */
export function precheckFile(kind: UploadKind, file: File): string | null {
  if (kind === UPLOAD_KIND.IMAGE && !isImageMime(file.type)) {
    return `图片格式必须是 ${Object.keys(ALLOWED_IMAGE_MIME)
      .map((m) => m.split("/")[1].toUpperCase())
      .join(" / ")}`;
  }
  if (kind === UPLOAD_KIND.VIDEO && !isVideoMime(file.type)) {
    return `视频格式必须是 ${Object.keys(ALLOWED_VIDEO_MIME)
      .map((m) => m.split("/")[1].toUpperCase())
      .join(" / ")}`;
  }
  const max = getMaxSize(kind);
  if (file.size > max) {
    return `文件超过 ${Math.round(max / 1024 / 1024)}MB 上限`;
  }
  if (file.size === 0) {
    return "文件为空";
  }
  return null;
}

/**
 * 浏览器侧上传：
 *  1. POST /api/uploads/sign → 拿预签名 URL
 *  2. XHR PUT 文件到 R2（带进度）
 *  3. 返回最终公开 URL
 *
 * 用 XMLHttpRequest 而不是 fetch，因为只有 XHR 才能拿到上传进度。
 */
export async function uploadFile(opts: UploadOptions): Promise<UploadResult> {
  const precheck = precheckFile(opts.kind, opts.file);
  if (precheck) throw new UploadClientError(precheck, "UPLOAD_VALIDATION");

  // Step 1 — 申请签名
  const signResp = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: opts.kind,
      mime: opts.file.type,
      size: opts.file.size,
      filename: opts.file.name,
    }),
    signal: opts.signal,
  });

  const signJson = (await signResp.json()) as SignResponse;
  if (!signResp.ok || !signJson.success || !signJson.data) {
    const msg =
      signJson.error?.message ??
      `签名失败 (HTTP ${signResp.status})，请稍后重试`;
    throw new UploadClientError(msg, signJson.error?.code ?? "SIGN_FAILED");
  }

  const { uploadUrl, publicUrl, objectKey, headers } = signJson.data;

  // Step 2 — 直传 R2，带进度
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) {
        opts.onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onProgress?.(100);
        resolve();
      } else {
        const text = xhr.responseText || "";
        const codeMatch = text.match(/<Code>([^<]+)<\/Code>/);
        const msgMatch = text.match(/<Message>([^<]+)<\/Message>/);
        const detail = codeMatch
          ? `${codeMatch[1]}${msgMatch ? " — " + msgMatch[1] : ""}`
          : text.slice(0, 200);
        reject(
          new UploadClientError(
            `上传失败 (HTTP ${xhr.status})${detail ? ": " + detail : ""}`,
            "PUT_FAILED",
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(new UploadClientError("网络错误，上传中断", "NETWORK"));
    xhr.onabort = () =>
      reject(new UploadClientError("已取消上传", "ABORTED"));

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort());
    }

    xhr.send(opts.file);
  });

  return { publicUrl, objectKey };
}
