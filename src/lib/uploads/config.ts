/**
 * 上传 / 存储配置 — Cloudflare R2 (S3 兼容)。
 *
 * 服务端读 STORAGE_* 环境变量；公开 base URL 也暴露给客户端做预览/展示。
 * 缺失任何必备变量时 getR2Config() 会抛出 — 由 API 路由捕获并返回 503。
 */

export const UPLOAD_KIND = {
  IMAGE: "image",
  VIDEO: "video",
} as const;
export type UploadKind = (typeof UPLOAD_KIND)[keyof typeof UPLOAD_KIND];

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

/** 允许的 MIME 与对应扩展。前端 <input accept> 和后端 presign 校验都用它。 */
export const ALLOWED_IMAGE_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const ALLOWED_VIDEO_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function isImageMime(mime: string): boolean {
  return mime in ALLOWED_IMAGE_MIME;
}

export function isVideoMime(mime: string): boolean {
  return mime in ALLOWED_VIDEO_MIME;
}

export function getMaxSize(kind: UploadKind): number {
  return kind === UPLOAD_KIND.IMAGE ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
}

export function getExtension(mime: string): string | null {
  return ALLOWED_IMAGE_MIME[mime] ?? ALLOWED_VIDEO_MIME[mime] ?? null;
}

export interface R2Config {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** S3 endpoint，形如 https://<accountid>.r2.cloudflarestorage.com */
  endpoint: string;
  /** 公开访问域名，形如 https://media.example.com 或 https://pub-xxx.r2.dev */
  publicBaseUrl: string;
}

/**
 * 读取并校验 R2 配置。
 * 任一字段缺失则抛 Error；调用方应捕获并返回服务暂不可用。
 */
export function getR2Config(): R2Config {
  const accessKeyId = process.env.STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET_KEY;
  const bucket = process.env.STORAGE_BUCKET;
  const endpoint = process.env.STORAGE_ENDPOINT;
  const publicBaseUrl = process.env.STORAGE_PUBLIC_BASE_URL;

  const missing: string[] = [];
  if (!accessKeyId) missing.push("STORAGE_ACCESS_KEY");
  if (!secretAccessKey) missing.push("STORAGE_SECRET_KEY");
  if (!bucket) missing.push("STORAGE_BUCKET");
  if (!endpoint) missing.push("STORAGE_ENDPOINT");
  if (!publicBaseUrl) missing.push("STORAGE_PUBLIC_BASE_URL");

  if (missing.length > 0) {
    throw new Error(
      `R2 storage is not configured. Missing env vars: ${missing.join(", ")}`,
    );
  }

  return {
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    bucket: bucket!,
    endpoint: endpoint!.replace(/\/+$/, ""),
    publicBaseUrl: publicBaseUrl!.replace(/\/+$/, ""),
  };
}
