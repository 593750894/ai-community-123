import { prisma } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { createAuditLog } from "@/lib/admin/audit";
import type {
  BlockedWord,
  BlockedWordScope,
  BlockedWordSeverity,
} from "@/generated/prisma/client";

/**
 * Stage 17.3：发布期关键词黑名单。
 *
 * 设计取舍：
 * - 单一 lib 入口 `assertNotBlocked(scope, ...haystacks)` 同时服务 API 路由 + server actions，
 *   避免「API 检查了 action 没检查」的覆盖漏洞。
 * - 命中算法：lowercase haystack + Postgres 侧拉 scope ∈ {ALL, scope} 的全部 pattern → 内存
 *   substring 比对。规模假设：词表 < 1000，单次 content < 100KB。
 * - 缓存：60s in-process LRU。admin CRUD 后 `invalidateBlockedWordCache()` 立即失效，避免新词
 *   要等 60s 才生效。多实例部署不强一致——MVP 可接受（同实例内 admin 自己改完即时生效，
 *   其它实例最多 1min 滞后；hard requirement 时改 Redis pub/sub）。
 * - BLOCK 命中 → 抛 ValidationError 含命中关键词列表（前端可高亮）；同时落审计 + hitCount++。
 * - WARN 命中 → 不阻塞，仅落审计供 admin /admin/audit-logs?action=BLOCKED_WORD_WARN_HIT 复查。
 * - pattern 落库时统一 lowercase（admin CRUD 入口处理），命中时也对 haystack lowercase。
 *
 * 调用者：
 * - posts/works/comments/collaborations/messages/workflow-items 6 个 create action / API。
 * - admin CRUD 自己也调 invalidateBlockedWordCache()，使变更立刻可见。
 */

const CACHE_TTL_MS = 60 * 1000;

interface CacheEntry {
  loadedAt: number;
  words: BlockedWord[];
}

let cache: CacheEntry | null = null;

export function invalidateBlockedWordCache(): void {
  cache = null;
}

async function getBlockedWords(): Promise<BlockedWord[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.words;
  }
  const words = await prisma.blockedWord.findMany({
    orderBy: { createdAt: "desc" },
  });
  cache = { loadedAt: Date.now(), words };
  return words;
}

export interface BlockedWordHit {
  id: string;
  pattern: string;
  severity: BlockedWordSeverity;
  scope: BlockedWordScope;
}

export interface BlockedWordCheckResult {
  blocks: BlockedWordHit[];
  warnings: BlockedWordHit[];
}

/**
 * 纯检查：返回命中的 BLOCK + WARN 词，不抛错、不写审计、不递增 hitCount。
 * 供前端预校验或 admin 测试用。日常 create 流程请用 `assertNotBlocked`。
 */
export async function checkBlockedWords(
  scope: BlockedWordScope,
  ...haystacks: Array<string | null | undefined>
): Promise<BlockedWordCheckResult> {
  const haystack = haystacks
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join("\n")
    .toLowerCase();
  if (!haystack) return { blocks: [], warnings: [] };

  const all = await getBlockedWords();
  const blocks: BlockedWordHit[] = [];
  const warnings: BlockedWordHit[] = [];
  for (const w of all) {
    if (w.scope !== "ALL" && w.scope !== scope) continue;
    if (!haystack.includes(w.pattern)) continue;
    const hit: BlockedWordHit = {
      id: w.id,
      pattern: w.pattern,
      severity: w.severity,
      scope: w.scope,
    };
    if (w.severity === "BLOCK") blocks.push(hit);
    else warnings.push(hit);
  }
  return { blocks, warnings };
}

/**
 * 在 create 入口调用：
 *  - BLOCK 命中 → 抛 ValidationError + details.blockedKeywords；并 fire-and-forget 落 audit + hitCount++。
 *  - WARN 命中 → 不抛错；fire-and-forget 落 audit（hitCount 不变 —— WARN 是观察样本，不是治理对象）。
 *
 * 调用方需要传一个 actor 信息供审计；server actions / API 拿到 user.id 后传入即可。
 */
export async function assertNotBlocked(
  args: {
    scope: BlockedWordScope;
    actorId: string;
    /** 内容来源标签，便于审计反查（如 "post:create" / "comment:create:postId=xxx"）。 */
    source?: string;
  },
  ...haystacks: Array<string | null | undefined>
): Promise<void> {
  const { blocks, warnings } = await checkBlockedWords(args.scope, ...haystacks);

  if (warnings.length > 0) {
    // 不阻塞主流程，单条审计记录所有 WARN 命中
    void createAuditLog({
      adminId: args.actorId, // 这里 actor 可能是普通用户；audit 字段名沿用现有 schema
      action: "BLOCKED_WORD_WARN_HIT",
      targetType: "BlockedWord",
      targetId: warnings.map((w) => w.id).join(","),
      metadata: {
        scope: args.scope,
        patterns: warnings.map((w) => w.pattern),
        source: args.source ?? null,
        actorIsUser: true,
      },
    }).catch((err) =>
      console.error("[blocked-words] warn audit failed", err),
    );
  }

  if (blocks.length > 0) {
    // fire-and-forget：审计 + hitCount++。失败不影响拒绝行为。
    void incrementHitCounts(blocks.map((b) => b.id)).catch((err) =>
      console.error("[blocked-words] hit count update failed", err),
    );
    void createAuditLog({
      adminId: args.actorId,
      action: "BLOCKED_WORD_BLOCK_HIT",
      targetType: "BlockedWord",
      targetId: blocks.map((b) => b.id).join(","),
      metadata: {
        scope: args.scope,
        patterns: blocks.map((b) => b.pattern),
        source: args.source ?? null,
        actorIsUser: true,
      },
    }).catch((err) =>
      console.error("[blocked-words] block audit failed", err),
    );
    throw new ValidationError("内容包含违禁关键词，无法发布", {
      blockedKeywords: blocks.map((b) => b.pattern),
    });
  }
}

async function incrementHitCounts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.blockedWord.updateMany({
    where: { id: { in: ids } },
    data: { hitCount: { increment: 1 } },
  });
}

// ────────────────────────────── Admin CRUD ──────────────────────────────

/** lowercase + trim pattern；空 / 过短 / 过长 → ValidationError。 */
export function normalizePattern(raw: string): string {
  const t = (raw ?? "").trim().toLowerCase();
  if (t.length < 2) {
    throw new ValidationError("关键词至少 2 个字符");
  }
  if (t.length > 64) {
    throw new ValidationError("关键词不超过 64 字符");
  }
  return t;
}

export interface CreateBlockedWordInput {
  pattern: string;
  severity: BlockedWordSeverity;
  scope: BlockedWordScope;
  note?: string | null;
}

export async function createBlockedWord(
  input: CreateBlockedWordInput,
  adminId: string,
): Promise<BlockedWord> {
  const pattern = normalizePattern(input.pattern);
  try {
    const created = await prisma.blockedWord.create({
      data: {
        pattern,
        severity: input.severity,
        scope: input.scope,
        note: input.note?.trim() || null,
        createdById: adminId,
      },
    });
    invalidateBlockedWordCache();
    return created;
  } catch (err) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new ValidationError("该关键词已存在");
    }
    throw err;
  }
}

export interface UpdateBlockedWordInput {
  severity?: BlockedWordSeverity;
  scope?: BlockedWordScope;
  note?: string | null;
  // 注意：不允许改 pattern——改 pattern 会让 hitCount / 审计语义错乱；
  // 需要不同 pattern 请删后重建。
}

export async function updateBlockedWord(
  id: string,
  input: UpdateBlockedWordInput,
): Promise<BlockedWord> {
  const updated = await prisma.blockedWord.update({
    where: { id },
    data: {
      ...(input.severity !== undefined ? { severity: input.severity } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.note !== undefined
        ? { note: input.note?.trim() || null }
        : {}),
    },
  });
  invalidateBlockedWordCache();
  return updated;
}

export async function deleteBlockedWord(id: string): Promise<void> {
  await prisma.blockedWord.delete({ where: { id } });
  invalidateBlockedWordCache();
}

export interface ListBlockedWordsArgs {
  q?: string;
  scope?: BlockedWordScope;
  severity?: BlockedWordSeverity;
  page?: number;
  pageSize?: number;
}

export interface BlockedWordRow {
  id: string;
  pattern: string;
  severity: BlockedWordSeverity;
  scope: BlockedWordScope;
  note: string | null;
  hitCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
    username: string;
  };
}

export async function listBlockedWords(
  args: ListBlockedWordsArgs,
): Promise<{
  items: BlockedWordRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const pageSize = Math.max(1, Math.min(args.pageSize ?? 30, 100));
  const page = Math.max(1, args.page ?? 1);
  const q = args.q?.trim().toLowerCase();

  const where = {
    ...(q ? { pattern: { contains: q } } : {}),
    ...(args.scope ? { scope: args.scope } : {}),
    ...(args.severity ? { severity: args.severity } : {}),
  };

  const [total, raw] = await Promise.all([
    prisma.blockedWord.count({ where }),
    prisma.blockedWord.findMany({
      where,
      orderBy: [{ hitCount: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        createdBy: { select: { id: true, name: true, username: true } },
      },
    }),
  ]);

  return {
    items: raw.map((w) => ({
      id: w.id,
      pattern: w.pattern,
      severity: w.severity,
      scope: w.scope,
      note: w.note,
      hitCount: w.hitCount,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      createdBy: w.createdBy,
    })),
    total,
    page,
    pageSize,
  };
}

export const BLOCKED_WORD_SEVERITIES: readonly BlockedWordSeverity[] = [
  "WARN",
  "BLOCK",
] as const;

export const BLOCKED_WORD_SEVERITY_LABEL: Record<BlockedWordSeverity, string> = {
  WARN: "WARN（仅告警 + 审计）",
  BLOCK: "BLOCK（拒绝创建）",
};

export const BLOCKED_WORD_SCOPES: readonly BlockedWordScope[] = [
  "ALL",
  "POST",
  "WORK",
  "COMMENT",
  "COLLABORATION",
  "MESSAGE",
  "WORKFLOW_ITEM",
] as const;

export const BLOCKED_WORD_SCOPE_LABEL: Record<BlockedWordScope, string> = {
  ALL: "全部内容",
  POST: "帖子",
  WORK: "作品",
  COMMENT: "评论",
  COLLABORATION: "合作",
  MESSAGE: "私信 / 群消息",
  WORKFLOW_ITEM: "工作流商品",
};
