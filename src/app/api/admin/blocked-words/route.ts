import { requireAdminApi } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { success, created, error } from "@/lib/response";
import { createRateLimiter } from "@/lib/rate-limit";
import { createAuditLog } from "@/lib/admin/audit";
import {
  CreateBlockedWordSchema,
  BLOCKED_WORD_SCOPE_VALUES,
  BLOCKED_WORD_SEVERITY_VALUES,
} from "@/lib/content/schemas";
import {
  createBlockedWord,
  listBlockedWords,
} from "@/lib/content/blocked-words";

const writeLimiter = createRateLimiter({
  limit: 50,
  windowMs: 60 * 1000,
  name: "blocked-word-write",
});

export async function GET(request: Request) {
  try {
    await requireAdminApi();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || undefined;
    const scopeRaw = url.searchParams.get("scope");
    const sevRaw = url.searchParams.get("severity");
    const page = Number(url.searchParams.get("page") ?? 1) || 1;
    const scope =
      scopeRaw && (BLOCKED_WORD_SCOPE_VALUES as readonly string[]).includes(scopeRaw)
        ? (scopeRaw as (typeof BLOCKED_WORD_SCOPE_VALUES)[number])
        : undefined;
    const severity =
      sevRaw && (BLOCKED_WORD_SEVERITY_VALUES as readonly string[]).includes(sevRaw)
        ? (sevRaw as (typeof BLOCKED_WORD_SEVERITY_VALUES)[number])
        : undefined;
    const result = await listBlockedWords({ q, scope, severity, page });
    return success(result);
  } catch (err) {
    return error(err);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApi();
    writeLimiter.check(admin.id);
    const body = await request.json().catch(() => null);
    const parsed = CreateBlockedWordSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    const word = await createBlockedWord(parsed.data, admin.id);
    void createAuditLog({
      adminId: admin.id,
      action: "BLOCKED_WORD_CREATE",
      targetType: "BlockedWord",
      targetId: word.id,
      metadata: {
        pattern: word.pattern,
        severity: word.severity,
        scope: word.scope,
      },
    });
    return created(word, "已新增违禁词");
  } catch (err) {
    return error(err);
  }
}
