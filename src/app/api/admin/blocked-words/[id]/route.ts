import { requireAdminApi } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { createRateLimiter } from "@/lib/rate-limit";
import { createAuditLog } from "@/lib/admin/audit";
import { UpdateBlockedWordSchema } from "@/lib/content/schemas";
import {
  deleteBlockedWord,
  updateBlockedWord,
} from "@/lib/content/blocked-words";

const writeLimiter = createRateLimiter({
  limit: 50,
  windowMs: 60 * 1000,
  name: "blocked-word-mutate",
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdminApi();
    const { id } = await params;
    writeLimiter.check(admin.id);
    const body = await request.json().catch(() => null);
    const parsed = UpdateBlockedWordSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    const updated = await updateBlockedWord(id, parsed.data);
    void createAuditLog({
      adminId: admin.id,
      action: "BLOCKED_WORD_UPDATE",
      targetType: "BlockedWord",
      targetId: updated.id,
      metadata: {
        pattern: updated.pattern,
        severity: updated.severity,
        scope: updated.scope,
      },
    });
    return success(updated, "已更新违禁词");
  } catch (err) {
    return error(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdminApi();
    const { id } = await params;
    writeLimiter.check(admin.id);
    await deleteBlockedWord(id);
    void createAuditLog({
      adminId: admin.id,
      action: "BLOCKED_WORD_DELETE",
      targetType: "BlockedWord",
      targetId: id,
      metadata: null,
    });
    return success(null, "已删除违禁词");
  } catch (err) {
    return error(err);
  }
}
