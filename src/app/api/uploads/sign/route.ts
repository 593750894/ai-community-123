import { z } from "zod";

import { requireAuth } from "@/lib/auth/guard";
import { AppError, ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  signUploadUrl,
  UploadNotConfiguredError,
  UploadValidationError,
} from "@/lib/uploads/server";
import { UPLOAD_KIND } from "@/lib/uploads/config";

const uploadLimiter = createRateLimiter({
  limit: 20,
  windowMs: 60 * 1000,
  name: "上传签名",
  message: ({ limit }) =>
    `上传过于频繁，请稍后再试（每分钟最多 ${limit} 次）`,
});

const Schema = z.object({
  kind: z.enum([UPLOAD_KIND.IMAGE, UPLOAD_KIND.VIDEO]),
  mime: z.string().min(1).max(120),
  size: z.number().int().positive(),
  filename: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }

    uploadLimiter.check(user.id);

    try {
      const result = await signUploadUrl({
        kind: parsed.data.kind,
        mime: parsed.data.mime,
        size: parsed.data.size,
        userId: user.id,
      });
      return success({
        uploadUrl: result.uploadUrl,
        publicUrl: result.publicUrl,
        objectKey: result.objectKey,
        headers: result.headers,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      if (err instanceof UploadValidationError) {
        throw new ValidationError(err.message, err.details);
      }
      if (err instanceof UploadNotConfiguredError) {
        throw new AppError(
          "上传服务暂未配置，请联系管理员",
          "STORAGE_NOT_CONFIGURED",
          503,
        );
      }
      throw err;
    }
  } catch (err) {
    return error(err);
  }
}
