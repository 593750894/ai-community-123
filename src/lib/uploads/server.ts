import { AwsClient } from "aws4fetch";

import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_VIDEO_MIME,
  getExtension,
  getMaxSize,
  getR2Config,
  isImageMime,
  isVideoMime,
  UPLOAD_KIND,
  type UploadKind,
} from "./config";

export interface SignUploadInput {
  kind: UploadKind;
  mime: string;
  size: number;
  userId: string;
}

export interface SignUploadResult {
  /** 浏览器直接 PUT 的 URL（已签名，含 X-Amz-* query） */
  uploadUrl: string;
  /** 上传完成后用于回写表单 / 数据库的最终展示 URL */
  publicUrl: string;
  /** R2 中的 object key（仅 server 内部使用，作为 metadata） */
  objectKey: string;
  /** PUT 时必须设置的 headers（Content-Type 等） */
  headers: Record<string, string>;
  /** 链接过期时间（ms epoch），客户端可用于决定是否要重新签名 */
  expiresAt: number;
}

const PRESIGN_EXPIRES_SECONDS = 5 * 60; // 5 分钟

/** Generate a URL-safe random key segment (cuid-ish, no deps). */
function randomKey(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function todaySegment(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

export class UploadValidationError extends Error {
  code = "UPLOAD_VALIDATION";
  details: Record<string, string[]>;
  constructor(message: string, details: Record<string, string[]>) {
    super(message);
    this.details = details;
  }
}

export class UploadNotConfiguredError extends Error {
  code = "UPLOAD_NOT_CONFIGURED";
  constructor(message: string) {
    super(message);
  }
}

/**
 * 校验上传请求。返回 normalized 字段或抛 UploadValidationError。
 */
export function validateUploadRequest(input: SignUploadInput): {
  ext: string;
  mime: string;
} {
  const errors: Record<string, string[]> = {};

  if (input.kind !== UPLOAD_KIND.IMAGE && input.kind !== UPLOAD_KIND.VIDEO) {
    errors.kind = [`kind 必须是 image 或 video`];
  }

  if (input.kind === UPLOAD_KIND.IMAGE && !isImageMime(input.mime)) {
    errors.mime = [
      `图片格式必须是 ${Object.keys(ALLOWED_IMAGE_MIME).join(" / ")}`,
    ];
  }
  if (input.kind === UPLOAD_KIND.VIDEO && !isVideoMime(input.mime)) {
    errors.mime = [
      `视频格式必须是 ${Object.keys(ALLOWED_VIDEO_MIME).join(" / ")}`,
    ];
  }

  const max = getMaxSize(input.kind);
  if (!Number.isFinite(input.size) || input.size <= 0) {
    errors.size = ["文件大小无效"];
  } else if (input.size > max) {
    const mb = Math.round(max / 1024 / 1024);
    errors.size = [`文件超过 ${mb}MB 上限`];
  }

  if (Object.keys(errors).length > 0) {
    throw new UploadValidationError("上传参数校验失败", errors);
  }

  const ext = getExtension(input.mime)!;
  return { ext, mime: input.mime };
}

/**
 * Sign a PUT URL for direct browser → R2 upload.
 *
 * Returns the presigned URL plus the publicly accessible URL the caller
 * should store after the PUT succeeds. R2 only honors signed headers, so
 * the caller MUST send the returned `headers` (Content-Type) with its PUT.
 */
export async function signUploadUrl(
  input: SignUploadInput,
): Promise<SignUploadResult> {
  const { ext, mime } = validateUploadRequest(input);

  let config;
  try {
    config = getR2Config();
  } catch (err) {
    throw new UploadNotConfiguredError(
      err instanceof Error ? err.message : String(err),
    );
  }

  const objectKey = `${input.kind}/${todaySegment()}/${input.userId}/${randomKey()}.${ext}`;

  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });

  const url = new URL(`${config.endpoint}/${config.bucket}/${objectKey}`);
  url.searchParams.set("X-Amz-Expires", String(PRESIGN_EXPIRES_SECONDS));

  const signed = await client.sign(
    new Request(url.toString(), {
      method: "PUT",
      headers: { "Content-Type": mime },
    }),
    { aws: { signQuery: true } },
  );

  return {
    uploadUrl: signed.url,
    publicUrl: `${config.publicBaseUrl}/${objectKey}`,
    objectKey,
    headers: { "Content-Type": mime },
    expiresAt: Date.now() + PRESIGN_EXPIRES_SECONDS * 1000,
  };
}
