import { z } from "zod";

import { requireAuth } from "@/lib/auth/guard";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { error, success } from "@/lib/response";
import { createRateLimiter } from "@/lib/rate-limit";
import { resolveClawback } from "@/lib/commerce/clawbacks";

const limiter = createRateLimiter({
  limit: 100,
  windowMs: 60_000,
  name: "Clawback 标记",
});

const ResolveSchema = z.object({
  toStatus: z.enum(["DEDUCTED", "MANUAL", "WAIVED"]),
  note: z
    .string()
    .trim()
    .max(500, "备注最多 500 字")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

/**
 * POST /api/admin/clawbacks/[id]/resolve
 * 仅 ADMIN；PENDING → 终态。终态后再调返 403（防误改）。
 * AuditLog 由 resolveClawback 内部统一记。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();
    limiter.check(user.id);

    const { id } = await params;
    if (!id) throw new NotFoundError("clawback");

    const body = await request.json().catch(() => ({}));
    const parsed = ResolveSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }

    await resolveClawback({
      clawbackId: id,
      adminId: user.id,
      toStatus: parsed.data.toStatus,
      note: parsed.data.note,
    });

    return success({ id, toStatus: parsed.data.toStatus }, "已更新");
  } catch (err) {
    return error(err);
  }
}
