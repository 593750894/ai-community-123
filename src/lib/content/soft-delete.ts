import { prisma, Prisma } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { createAuditLog, type AuditAction } from "@/lib/admin/audit";
import { notifyContentRemoved } from "@/lib/notifications/emit";
import type { ContentTargetType } from "@/lib/content/schemas";

/**
 * Stage 17.2：内容软删除 + 恢复的统一入口。
 *
 * 设计取舍：
 * - 「作者本人 DELETE 自己内容」仍走原硬删除路径（API 路由 DELETE handler）—— 用户主动选择，
 *   无人申诉对象；保留旧行为不动。
 * - MOD/ADMIN 经 /admin 或处理举报触发的下架走本模块；落 deletedAt + 通知作者 + 审计 +
 *   触发申诉入口。
 * - softDeleteXxx 是幂等的：已 deletedAt 的内容再次调用 → 抛 ConflictError（避免重复通知 / 审计）。
 * - restoreXxx 同样幂等：未删除内容再次调用 → ConflictError。
 * - 通知 + 审计 fire-and-forget（在 DB 事务外），失败不阻塞主流程。
 *
 * 调用者：
 * - src/lib/admin/actions.ts adminDeletePost/Work/Collab/Comment
 * - src/lib/reports/actions.ts deleteReportTargetInTx
 * - src/lib/content/appeals.ts reviewAppeal (APPROVE → restoreXxx)
 */

export interface SoftDeleteArgs {
  actorId: string; // MOD/ADMIN id
  reason?: string | null;
  /** 通知作者时是否要附带原因。报告路径默认带；admin 后台路径可选。 */
  notifyAuthor?: boolean;
  /** 用于 audit metadata 的来源标签（"admin" | "report"）。 */
  source?: string;
}

export interface SoftDeleteResult {
  /** 是否成功执行（false = 内容不存在或已删除）。 */
  ok: boolean;
  /** 作者 ID（用于跨调用方做额外操作；删除已 not-found 时为 null）。 */
  authorId: string | null;
  /** 内容标题快照，便于通知 / 审计；不存在时 null。 */
  titleSnippet: string | null;
}

// ────────────────── Post ──────────────────

export async function softDeletePost(
  postId: string,
  args: SoftDeleteArgs,
): Promise<SoftDeleteResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      title: true,
      channelId: true,
      deletedAt: true,
    },
  });
  if (!post) return { ok: false, authorId: null, titleSnippet: null };
  if (post.deletedAt) {
    throw new ConflictError("内容已被下架");
  }

  const reason = args.reason?.trim() || null;
  const now = new Date();
  await prisma.post.update({
    where: { id: postId },
    data: {
      deletedAt: now,
      deletedById: args.actorId,
      deletionReason: reason,
    },
  });

  fireAndForgetAudit({
    actorId: args.actorId,
    action: "SOFT_DELETE_POST",
    targetType: "Post",
    targetId: postId,
    metadata: {
      title: post.title,
      authorId: post.authorId,
      channelId: post.channelId,
      reason,
      source: args.source ?? "admin",
    },
  });
  if (args.notifyAuthor !== false) {
    fireAndForgetNotify(() =>
      notifyContentRemoved({
        recipientId: post.authorId,
        targetType: "POST",
        targetId: postId,
        titleSnippet: post.title.slice(0, 120),
        reason,
      }),
    );
  }
  return { ok: true, authorId: post.authorId, titleSnippet: post.title };
}

export async function restorePost(
  postId: string,
  args: { actorId: string; reviewerSource?: string },
): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, deletedAt: true, authorId: true, title: true },
  });
  if (!post) throw new NotFoundError("帖子");
  if (!post.deletedAt) throw new ConflictError("内容未处于下架状态");
  await prisma.post.update({
    where: { id: postId },
    data: {
      deletedAt: null,
      deletedById: null,
      deletionReason: null,
    },
  });
  fireAndForgetAudit({
    actorId: args.actorId,
    action: "RESTORE_POST",
    targetType: "Post",
    targetId: postId,
    metadata: {
      title: post.title,
      authorId: post.authorId,
      source: args.reviewerSource ?? "admin",
    },
  });
}

// ────────────────── Work ──────────────────

export async function softDeleteWork(
  workId: string,
  args: SoftDeleteArgs,
): Promise<SoftDeleteResult> {
  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: {
      id: true,
      authorId: true,
      title: true,
      deletedAt: true,
    },
  });
  if (!work) return { ok: false, authorId: null, titleSnippet: null };
  if (work.deletedAt) throw new ConflictError("内容已被下架");

  const reason = args.reason?.trim() || null;
  await prisma.work.update({
    where: { id: workId },
    data: {
      deletedAt: new Date(),
      deletedById: args.actorId,
      deletionReason: reason,
    },
  });
  fireAndForgetAudit({
    actorId: args.actorId,
    action: "SOFT_DELETE_WORK",
    targetType: "Work",
    targetId: workId,
    metadata: {
      title: work.title,
      authorId: work.authorId,
      reason,
      source: args.source ?? "admin",
    },
  });
  if (args.notifyAuthor !== false) {
    fireAndForgetNotify(() =>
      notifyContentRemoved({
        recipientId: work.authorId,
        targetType: "WORK",
        targetId: workId,
        titleSnippet: work.title.slice(0, 120),
        reason,
      }),
    );
  }
  return { ok: true, authorId: work.authorId, titleSnippet: work.title };
}

export async function restoreWork(
  workId: string,
  args: { actorId: string; reviewerSource?: string },
): Promise<void> {
  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: { id: true, deletedAt: true, authorId: true, title: true },
  });
  if (!work) throw new NotFoundError("作品");
  if (!work.deletedAt) throw new ConflictError("内容未处于下架状态");
  await prisma.work.update({
    where: { id: workId },
    data: {
      deletedAt: null,
      deletedById: null,
      deletionReason: null,
    },
  });
  fireAndForgetAudit({
    actorId: args.actorId,
    action: "RESTORE_WORK",
    targetType: "Work",
    targetId: workId,
    metadata: {
      title: work.title,
      authorId: work.authorId,
      source: args.reviewerSource ?? "admin",
    },
  });
}

// ────────────────── Comment ──────────────────

export async function softDeleteComment(
  commentId: string,
  args: SoftDeleteArgs,
): Promise<SoftDeleteResult> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
      content: true,
      postId: true,
      parentId: true,
      deletedAt: true,
    },
  });
  if (!comment) return { ok: false, authorId: null, titleSnippet: null };
  if (comment.deletedAt) throw new ConflictError("内容已被下架");

  const reason = args.reason?.trim() || null;
  // 评论软删除时 commentCount 也要减——public 列表不再展示。
  // 恢复时 +1 回去。
  await prisma.$transaction([
    prisma.comment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
        deletedById: args.actorId,
        deletionReason: reason,
      },
    }),
    prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { decrement: 1 } },
    }),
  ]);
  fireAndForgetAudit({
    actorId: args.actorId,
    action: "SOFT_DELETE_COMMENT",
    targetType: "Comment",
    targetId: commentId,
    metadata: {
      postId: comment.postId,
      authorId: comment.authorId,
      parentId: comment.parentId,
      contentSnippet: comment.content.slice(0, 120),
      reason,
      source: args.source ?? "admin",
    },
  });
  if (args.notifyAuthor !== false) {
    fireAndForgetNotify(() =>
      notifyContentRemoved({
        recipientId: comment.authorId,
        targetType: "COMMENT",
        targetId: commentId,
        titleSnippet: comment.content.slice(0, 80),
        reason,
      }),
    );
  }
  return {
    ok: true,
    authorId: comment.authorId,
    titleSnippet: comment.content.slice(0, 80),
  };
}

export async function restoreComment(
  commentId: string,
  args: { actorId: string; reviewerSource?: string },
): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      deletedAt: true,
      authorId: true,
      postId: true,
      content: true,
    },
  });
  if (!comment) throw new NotFoundError("评论");
  if (!comment.deletedAt) throw new ConflictError("内容未处于下架状态");
  await prisma.$transaction([
    prisma.comment.update({
      where: { id: commentId },
      data: {
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
      },
    }),
    prisma.post.update({
      where: { id: comment.postId },
      data: { commentCount: { increment: 1 } },
    }),
  ]);
  fireAndForgetAudit({
    actorId: args.actorId,
    action: "RESTORE_COMMENT",
    targetType: "Comment",
    targetId: commentId,
    metadata: {
      postId: comment.postId,
      authorId: comment.authorId,
      contentSnippet: comment.content.slice(0, 120),
      source: args.reviewerSource ?? "admin",
    },
  });
}

// ────────────────── Collaboration ──────────────────

export async function softDeleteCollaboration(
  collabId: string,
  args: SoftDeleteArgs,
): Promise<SoftDeleteResult> {
  const collab = await prisma.collaboration.findUnique({
    where: { id: collabId },
    select: {
      id: true,
      authorId: true,
      title: true,
      status: true,
      deletedAt: true,
    },
  });
  if (!collab) return { ok: false, authorId: null, titleSnippet: null };
  if (collab.deletedAt) throw new ConflictError("内容已被下架");

  const reason = args.reason?.trim() || null;
  await prisma.collaboration.update({
    where: { id: collabId },
    data: {
      deletedAt: new Date(),
      deletedById: args.actorId,
      deletionReason: reason,
    },
  });
  fireAndForgetAudit({
    actorId: args.actorId,
    action: "SOFT_DELETE_COLLAB",
    targetType: "Collaboration",
    targetId: collabId,
    metadata: {
      title: collab.title,
      authorId: collab.authorId,
      statusBefore: collab.status,
      reason,
      source: args.source ?? "admin",
    },
  });
  if (args.notifyAuthor !== false) {
    fireAndForgetNotify(() =>
      notifyContentRemoved({
        recipientId: collab.authorId,
        targetType: "COLLABORATION",
        targetId: collabId,
        titleSnippet: collab.title.slice(0, 120),
        reason,
      }),
    );
  }
  return { ok: true, authorId: collab.authorId, titleSnippet: collab.title };
}

export async function restoreCollaboration(
  collabId: string,
  args: { actorId: string; reviewerSource?: string },
): Promise<void> {
  const collab = await prisma.collaboration.findUnique({
    where: { id: collabId },
    select: { id: true, deletedAt: true, authorId: true, title: true },
  });
  if (!collab) throw new NotFoundError("合作");
  if (!collab.deletedAt) throw new ConflictError("内容未处于下架状态");
  await prisma.collaboration.update({
    where: { id: collabId },
    data: {
      deletedAt: null,
      deletedById: null,
      deletionReason: null,
    },
  });
  fireAndForgetAudit({
    actorId: args.actorId,
    action: "RESTORE_COLLAB",
    targetType: "Collaboration",
    targetId: collabId,
    metadata: {
      title: collab.title,
      authorId: collab.authorId,
      source: args.reviewerSource ?? "admin",
    },
  });
}

// ────────────────── 多态 dispatcher（举报处理用） ──────────────────

/**
 * 给 reports/actions.ts 用：根据 targetType 软删除并返回审计 action 字符串。
 * 已删除内容 → ok=false（与硬删除路径行为兼容，举报方上层会写 reportTarget=not found）。
 *
 * 注意：与原 `deleteReportTargetInTx` 不同，此函数不在事务内（软删除是 single-row update，
 * 跟 report.update 串联即可，无需跨表原子性）。
 */
export async function softDeleteContentByTarget(
  targetType: ContentTargetType,
  targetId: string,
  args: SoftDeleteArgs,
): Promise<{ ok: boolean; action: AuditAction | null }> {
  try {
    switch (targetType) {
      case "POST": {
        const r = await softDeletePost(targetId, args);
        return { ok: r.ok, action: r.ok ? "SOFT_DELETE_POST" : null };
      }
      case "WORK": {
        const r = await softDeleteWork(targetId, args);
        return { ok: r.ok, action: r.ok ? "SOFT_DELETE_WORK" : null };
      }
      case "COMMENT": {
        const r = await softDeleteComment(targetId, args);
        return { ok: r.ok, action: r.ok ? "SOFT_DELETE_COMMENT" : null };
      }
      case "COLLABORATION": {
        const r = await softDeleteCollaboration(targetId, args);
        return { ok: r.ok, action: r.ok ? "SOFT_DELETE_COLLAB" : null };
      }
      default:
        return { ok: false, action: null };
    }
  } catch (err) {
    if (err instanceof ConflictError) {
      // 已下架——视为幂等成功（举报路径不需要二次操作）。
      return { ok: true, action: null };
    }
    throw err;
  }
}

// ────────────────── helpers ──────────────────

function fireAndForgetAudit(input: {
  actorId: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  void createAuditLog({
    adminId: input.actorId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata ?? null,
  });
}

function fireAndForgetNotify(fn: () => Promise<unknown>) {
  fn().catch((err) => console.error("[soft-delete] notify failed", err));
}

/** 对外导出，方便 query 层判断现状（保持 Prisma 类型同步）。 */
export const SOFT_DELETE_OMIT_WHERE: Prisma.PostWhereInput = {
  deletedAt: null,
};

// ────────────────────── Stage 18.0 hard-cleanup cron ──────────────────────

/**
 * Stage 18.0：超过 cleanupAfterMs 的 soft-deleted 内容物理删除（DB 行真删）。
 *
 * 资格：
 *   - deletedAt 非空且早于 cutoff
 *   - 同 (targetType, targetId) 在 content_appeals 表里没有 PENDING 申诉
 *     —— 哪怕用户已超期才提交申诉（理论上 7 天后才发），也要等 admin 处理完才能清；
 *     这是合规面：用户上诉中的内容不可消失。
 *
 * 顺序：分批扫描 → 逐条 prisma.delete()。失败的行跳过下一轮再试。
 * Comment 软删除时已 decrement commentCount；本函数硬删时不再回写（commentCount 不再受影响，
 * 因为软删时已扣过）。
 *
 * 不写 AuditLog：硬清理是 cron 例行垃圾回收，规模可能大，避免日志爆炸。
 * 如需追溯：每条记录在 SOFT_DELETE 时已有审计，硬清理只是物理回收。
 */
export interface HardCleanupResult {
  posts: number;
  works: number;
  comments: number;
  collaborations: number;
}

const DEFAULT_CLEANUP_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

export async function hardCleanupSoftDeleted(args?: {
  cleanupAfterMs?: number;
  perBatchLimit?: number;
}): Promise<HardCleanupResult> {
  const cleanupAfterMs = args?.cleanupAfterMs ?? DEFAULT_CLEANUP_AFTER_MS;
  const limit = Math.max(1, Math.min(args?.perBatchLimit ?? 200, 1000));
  const cutoff = new Date(Date.now() - cleanupAfterMs);

  const [posts, works, comments, collabs] = await Promise.all([
    cleanupKind("POST", cutoff, limit),
    cleanupKind("WORK", cutoff, limit),
    cleanupKind("COMMENT", cutoff, limit),
    cleanupKind("COLLABORATION", cutoff, limit),
  ]);

  return {
    posts,
    works,
    comments,
    collaborations: collabs,
  };
}

async function cleanupKind(
  kind: ContentTargetType,
  cutoff: Date,
  limit: number,
): Promise<number> {
  // 1) 找候选 id（cap by limit）
  const candidates = await listCleanupCandidates(kind, cutoff, limit);
  if (candidates.length === 0) return 0;

  // 2) 找 PENDING 申诉的 id 集合，从候选里剔除
  const pendingAppealed = await prisma.contentAppeal.findMany({
    where: {
      targetType: kind,
      targetId: { in: candidates },
      status: "PENDING",
    },
    select: { targetId: true },
  });
  const blocked = new Set(pendingAppealed.map((a) => a.targetId));
  const toDelete = candidates.filter((id) => !blocked.has(id));
  if (toDelete.length === 0) return 0;

  // 3) 逐条 delete（容错：单行失败不阻塞整批）
  let deleted = 0;
  for (const id of toDelete) {
    try {
      await hardDeleteOne(kind, id);
      deleted += 1;
    } catch (err) {
      console.error(`[hard-cleanup] failed for ${kind}:${id}`, err);
    }
  }
  return deleted;
}

async function listCleanupCandidates(
  kind: ContentTargetType,
  cutoff: Date,
  limit: number,
): Promise<string[]> {
  const where = {
    deletedAt: { lt: cutoff, not: null },
  } as const;
  switch (kind) {
    case "POST": {
      const rows = await prisma.post.findMany({
        where,
        select: { id: true },
        take: limit,
        orderBy: { deletedAt: "asc" },
      });
      return rows.map((r) => r.id);
    }
    case "WORK": {
      const rows = await prisma.work.findMany({
        where,
        select: { id: true },
        take: limit,
        orderBy: { deletedAt: "asc" },
      });
      return rows.map((r) => r.id);
    }
    case "COMMENT": {
      const rows = await prisma.comment.findMany({
        where,
        select: { id: true },
        take: limit,
        orderBy: { deletedAt: "asc" },
      });
      return rows.map((r) => r.id);
    }
    case "COLLABORATION": {
      const rows = await prisma.collaboration.findMany({
        where,
        select: { id: true },
        take: limit,
        orderBy: { deletedAt: "asc" },
      });
      return rows.map((r) => r.id);
    }
  }
}

async function hardDeleteOne(
  kind: ContentTargetType,
  id: string,
): Promise<void> {
  switch (kind) {
    case "POST":
      await prisma.post.delete({ where: { id } });
      return;
    case "WORK":
      await prisma.work.delete({ where: { id } });
      return;
    case "COMMENT":
      // 软删时已 decrement commentCount，硬删不再回写。
      await prisma.comment.delete({ where: { id } });
      return;
    case "COLLABORATION":
      await prisma.collaboration.delete({ where: { id } });
      return;
  }
}
