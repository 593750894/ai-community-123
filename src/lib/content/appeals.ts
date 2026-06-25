import { prisma, Prisma } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { createAuditLog } from "@/lib/admin/audit";
import {
  notifyAppealApproved,
  notifyAppealRejected,
} from "@/lib/notifications/emit";
import {
  restorePost,
  restoreWork,
  restoreComment,
  restoreCollaboration,
} from "@/lib/content/soft-delete";
import type {
  ContentTargetType,
  ReviewAppealInput,
  SubmitAppealInput,
} from "@/lib/content/schemas";

/**
 * Stage 17.2：内容申诉业务层。
 *
 * 生命周期：
 * - PENDING：作者提交；同一 (targetType, targetId) 全局至多一条 PENDING（DB 部分唯一索引兜底）。
 * - APPROVED：admin 审核通过 → 调用对应 restoreXxx 恢复 + 通知作者。
 * - REJECTED：admin 驳回（必填 reviewNote）→ 通知作者。
 * - CANCELED：作者撤回 PENDING（不允许在 APPROVED/REJECTED 后撤回）。
 *
 * 资格校验：
 * - 目标内容必须真实存在；
 * - 目标内容必须 deletedAt 非空（未被下架的内容无可申诉）；
 * - 仅原作者可申诉（authorId 比对）。
 *
 * 审核者：ADMIN（不允许 MOD 审核申诉——避免「同一个 MOD 下架 + 自己审申诉」的角色冲突）。
 */

/** Stage 18.0：同一 target 累计 REJECTED 上限；达到后业务层拒绝再发起。 */
export const MAX_APPEAL_RETRY = 3;

export interface AppealTargetSnapshot {
  authorId: string;
  titleSnippet: string;
  deletedAt: Date;
  deletionReason: string | null;
}

/**
 * 读取被申诉目标的快照信息（authorId / titleSnippet / deletedAt / reason）。
 * 不存在或未被软删除 → null。
 */
export async function getAppealTargetSnapshot(
  targetType: ContentTargetType,
  targetId: string,
): Promise<AppealTargetSnapshot | null> {
  switch (targetType) {
    case "POST": {
      const p = await prisma.post.findUnique({
        where: { id: targetId },
        select: {
          authorId: true,
          title: true,
          deletedAt: true,
          deletionReason: true,
        },
      });
      if (!p || !p.deletedAt) return null;
      return {
        authorId: p.authorId,
        titleSnippet: p.title.slice(0, 120),
        deletedAt: p.deletedAt,
        deletionReason: p.deletionReason,
      };
    }
    case "WORK": {
      const w = await prisma.work.findUnique({
        where: { id: targetId },
        select: {
          authorId: true,
          title: true,
          deletedAt: true,
          deletionReason: true,
        },
      });
      if (!w || !w.deletedAt) return null;
      return {
        authorId: w.authorId,
        titleSnippet: w.title.slice(0, 120),
        deletedAt: w.deletedAt,
        deletionReason: w.deletionReason,
      };
    }
    case "COMMENT": {
      const c = await prisma.comment.findUnique({
        where: { id: targetId },
        select: {
          authorId: true,
          content: true,
          deletedAt: true,
          deletionReason: true,
        },
      });
      if (!c || !c.deletedAt) return null;
      return {
        authorId: c.authorId,
        titleSnippet: c.content.slice(0, 80),
        deletedAt: c.deletedAt,
        deletionReason: c.deletionReason,
      };
    }
    case "COLLABORATION": {
      const k = await prisma.collaboration.findUnique({
        where: { id: targetId },
        select: {
          authorId: true,
          title: true,
          deletedAt: true,
          deletionReason: true,
        },
      });
      if (!k || !k.deletedAt) return null;
      return {
        authorId: k.authorId,
        titleSnippet: k.title.slice(0, 120),
        deletedAt: k.deletedAt,
        deletionReason: k.deletionReason,
      };
    }
    default:
      return null;
  }
}

/**
 * 提交申诉。
 * 校验：目标存在 + 处于下架状态 + appellant=作者 + 当前无 PENDING。
 * P2002（部分唯一索引）兜并发：双击 / 网络重试时只会成功创建一条。
 */
export async function submitAppeal(
  input: SubmitAppealInput,
  appellantId: string,
): Promise<{ id: string }> {
  const target = await getAppealTargetSnapshot(input.targetType, input.targetId);
  if (!target) throw new NotFoundError("可申诉的内容");
  if (target.authorId !== appellantId) {
    throw new ForbiddenError("只能为自己的内容发起申诉");
  }

  // 业务层先检查 PENDING 是否已存在，给友好错误（DB 部分唯一索引是 fallback）。
  const existing = await prisma.contentAppeal.findFirst({
    where: {
      targetType: input.targetType,
      targetId: input.targetId,
      status: "PENDING",
    },
    select: { id: true, appellantId: true },
  });
  if (existing) {
    // 既然 PENDING 在全局唯一，理论上 appellantId 必然 = 当前作者；
    // 只为安全起见还是统一拒绝。
    throw new ConflictError("已有进行中的申诉，请等待审核结果");
  }

  // Stage 18.0：同一 (targetType, targetId) 最多接受 MAX_APPEAL_RETRY 次 REJECTED，
  // 防止用户刷申诉骚扰审核员；APPROVED / CANCELED 不计数。
  const rejectedCount = await prisma.contentAppeal.count({
    where: {
      targetType: input.targetType,
      targetId: input.targetId,
      status: "REJECTED",
    },
  });
  if (rejectedCount >= MAX_APPEAL_RETRY) {
    throw new ConflictError(
      `该内容的申诉已被驳回 ${rejectedCount} 次，达到最大重试次数 ${MAX_APPEAL_RETRY}，如有异议请联系管理员`,
    );
  }

  try {
    const created = await prisma.contentAppeal.create({
      data: {
        appellantId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        status: "PENDING",
      },
      select: { id: true },
    });
    return created;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new ConflictError("已有进行中的申诉，请等待审核结果");
    }
    throw err;
  }
}

/** 作者撤回 PENDING 申诉。 */
export async function cancelAppeal(
  appealId: string,
  appellantId: string,
): Promise<void> {
  const appeal = await prisma.contentAppeal.findUnique({
    where: { id: appealId },
    select: { id: true, appellantId: true, status: true },
  });
  if (!appeal) throw new NotFoundError("申诉");
  if (appeal.appellantId !== appellantId) {
    throw new ForbiddenError("只能撤回自己提交的申诉");
  }
  if (appeal.status !== "PENDING") {
    throw new ConflictError("仅可撤回审核中的申诉");
  }
  const { count } = await prisma.contentAppeal.updateMany({
    where: { id: appealId, status: "PENDING" },
    data: { status: "CANCELED" },
  });
  if (count === 0) {
    throw new ConflictError("申诉状态已变更");
  }
}

/**
 * Admin 审核申诉。APPROVE → 调对应 restoreXxx；REJECT → 仅落 reviewNote + 通知。
 * REJECT 必填 reviewNote（Zod superRefine 已校验）。
 */
export async function reviewAppeal(
  appealId: string,
  payload: ReviewAppealInput,
  adminId: string,
): Promise<void> {
  const appeal = await prisma.contentAppeal.findUnique({
    where: { id: appealId },
    select: {
      id: true,
      status: true,
      appellantId: true,
      targetType: true,
      targetId: true,
    },
  });
  if (!appeal) throw new NotFoundError("申诉");
  if (appeal.status !== "PENDING") {
    throw new ConflictError("该申诉已处理过");
  }

  const nextStatus = payload.decision === "APPROVE" ? "APPROVED" : "REJECTED";
  const reviewNote = payload.reviewNote?.trim() || null;

  // 1) 原子 finalize：updateMany WHERE status='PENDING' 兜并发。
  const { count } = await prisma.contentAppeal.updateMany({
    where: { id: appealId, status: "PENDING" },
    data: {
      status: nextStatus,
      reviewNote,
      reviewedById: adminId,
      reviewedAt: new Date(),
    },
  });
  if (count === 0) {
    throw new ConflictError("申诉状态已变更");
  }

  // 2) APPROVE 时恢复内容；恢复结果决定后续通知是「已恢复」还是「申诉通过但内容已不可恢复」。
  //    内容期间被硬删等边缘情况下，仍保持申诉 = APPROVED 便于审计追溯。
  let restoreOk = true;
  if (payload.decision === "APPROVE") {
    try {
      const tgt = appeal.targetType as ContentTargetType;
      switch (tgt) {
        case "POST":
          await restorePost(appeal.targetId, {
            actorId: adminId,
            reviewerSource: "appeal",
          });
          break;
        case "WORK":
          await restoreWork(appeal.targetId, {
            actorId: adminId,
            reviewerSource: "appeal",
          });
          break;
        case "COMMENT":
          await restoreComment(appeal.targetId, {
            actorId: adminId,
            reviewerSource: "appeal",
          });
          break;
        case "COLLABORATION":
          await restoreCollaboration(appeal.targetId, {
            actorId: adminId,
            reviewerSource: "appeal",
          });
          break;
      }
    } catch (err) {
      restoreOk = false;
      console.error("[appeals] restore on approve failed", err);
    }
  }

  // 3) AuditLog（fire-and-forget）
  void createAuditLog({
    adminId,
    action: payload.decision === "APPROVE" ? "APPEAL_APPROVE" : "APPEAL_REJECT",
    targetType: "ContentAppeal",
    targetId: appealId,
    metadata: {
      appellantId: appeal.appellantId,
      contentTargetType: appeal.targetType,
      contentTargetId: appeal.targetId,
      reviewNote,
    },
  });

  // 4) 通知申诉人（fire-and-forget）
  //    APPROVE 时若 restore 失败（内容已不在），通知文案需诚实告知：申诉通过但内容已不可恢复，
  //    避免用户回访发现「明明说恢复了却还是空」。
  const tgt = appeal.targetType as ContentTargetType;
  if (payload.decision === "APPROVE") {
    notifyAppealApproved({
      recipientId: appeal.appellantId,
      targetType: tgt,
      targetId: appeal.targetId,
      reviewNote: restoreOk
        ? reviewNote
        : (reviewNote
            ? `${reviewNote}\n（注：原内容已不可恢复，如有疑问请联系管理员。）`
            : "申诉通过，但原内容已不可恢复，如有疑问请联系管理员。"),
    }).catch((err) =>
      console.error("[appeals] notifyAppealApproved failed", err),
    );
  } else {
    notifyAppealRejected({
      recipientId: appeal.appellantId,
      targetType: tgt,
      targetId: appeal.targetId,
      reviewNote: reviewNote ?? "申诉未通过",
    }).catch((err) =>
      console.error("[appeals] notifyAppealRejected failed", err),
    );
  }
}

// ────────────────── 查询层 ──────────────────

export interface ListAppealsArgs {
  status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
  q?: string; // admin 搜索 appellant.username / targetId
  page?: number;
  pageSize?: number;
}

export interface AppealRow {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELED";
  reason: string;
  reviewNote: string | null;
  targetType: ContentTargetType;
  targetId: string;
  createdAt: Date;
  reviewedAt: Date | null;
  appellant: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
  };
  reviewedBy: { id: string; name: string; username: string } | null;
  /** 内容标题/正文快照；不存在时 null。 */
  contentSnippet: string | null;
  /** 内容是否仍被下架（用于 admin 看「APPROVED 但被作者后续删了」的 edge case）。 */
  contentStillDeleted: boolean | null;
}

const APPELLANT_INCLUDE = {
  select: { id: true, name: true, username: true, avatar: true },
} satisfies Prisma.UserDefaultArgs;

const REVIEWER_INCLUDE = {
  select: { id: true, name: true, username: true },
} satisfies Prisma.UserDefaultArgs;

async function hydrateContentSnippets(
  appeals: Array<{ targetType: string; targetId: string }>,
): Promise<Map<string, { titleSnippet: string; deletedAt: Date | null }>> {
  const map = new Map<string, { titleSnippet: string; deletedAt: Date | null }>();
  const bucket = {
    POST: [] as string[],
    WORK: [] as string[],
    COMMENT: [] as string[],
    COLLABORATION: [] as string[],
  };
  for (const a of appeals) {
    if (a.targetType in bucket) {
      bucket[a.targetType as keyof typeof bucket].push(a.targetId);
    }
  }
  const [posts, works, comments, collabs] = await Promise.all([
    bucket.POST.length
      ? prisma.post.findMany({
          where: { id: { in: bucket.POST } },
          select: { id: true, title: true, deletedAt: true },
        })
      : Promise.resolve([]),
    bucket.WORK.length
      ? prisma.work.findMany({
          where: { id: { in: bucket.WORK } },
          select: { id: true, title: true, deletedAt: true },
        })
      : Promise.resolve([]),
    bucket.COMMENT.length
      ? prisma.comment.findMany({
          where: { id: { in: bucket.COMMENT } },
          select: { id: true, content: true, deletedAt: true },
        })
      : Promise.resolve([]),
    bucket.COLLABORATION.length
      ? prisma.collaboration.findMany({
          where: { id: { in: bucket.COLLABORATION } },
          select: { id: true, title: true, deletedAt: true },
        })
      : Promise.resolve([]),
  ]);
  for (const p of posts) {
    map.set(`POST:${p.id}`, {
      titleSnippet: p.title.slice(0, 120),
      deletedAt: p.deletedAt,
    });
  }
  for (const w of works) {
    map.set(`WORK:${w.id}`, {
      titleSnippet: w.title.slice(0, 120),
      deletedAt: w.deletedAt,
    });
  }
  for (const c of comments) {
    map.set(`COMMENT:${c.id}`, {
      titleSnippet: c.content.slice(0, 80),
      deletedAt: c.deletedAt,
    });
  }
  for (const k of collabs) {
    map.set(`COLLABORATION:${k.id}`, {
      titleSnippet: k.title.slice(0, 120),
      deletedAt: k.deletedAt,
    });
  }
  return map;
}

function mapAppealRow(
  appeal: {
    id: string;
    status: string;
    reason: string;
    reviewNote: string | null;
    targetType: string;
    targetId: string;
    createdAt: Date;
    reviewedAt: Date | null;
    appellant: { id: string; name: string; username: string; avatar: string | null };
    reviewedBy: { id: string; name: string; username: string } | null;
  },
  snippetMap: Map<string, { titleSnippet: string; deletedAt: Date | null }>,
): AppealRow {
  const key = `${appeal.targetType}:${appeal.targetId}`;
  const snip = snippetMap.get(key);
  return {
    id: appeal.id,
    status: appeal.status as AppealRow["status"],
    reason: appeal.reason,
    reviewNote: appeal.reviewNote,
    targetType: appeal.targetType as ContentTargetType,
    targetId: appeal.targetId,
    createdAt: appeal.createdAt,
    reviewedAt: appeal.reviewedAt,
    appellant: appeal.appellant,
    reviewedBy: appeal.reviewedBy,
    contentSnippet: snip?.titleSnippet ?? null,
    contentStillDeleted: snip ? snip.deletedAt !== null : null,
  };
}

export async function listMyAppeals(
  userId: string,
  args: ListAppealsArgs,
): Promise<{
  items: AppealRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const pageSize = Math.max(1, Math.min(args.pageSize ?? 20, 50));
  const page = Math.max(1, args.page ?? 1);

  const where: Prisma.ContentAppealWhereInput = {
    appellantId: userId,
    ...(args.status ? { status: args.status } : {}),
  };

  const [total, raw] = await Promise.all([
    prisma.contentAppeal.count({ where }),
    prisma.contentAppeal.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        appellant: APPELLANT_INCLUDE,
        reviewedBy: REVIEWER_INCLUDE,
      },
    }),
  ]);
  const snippetMap = await hydrateContentSnippets(raw);
  return {
    items: raw.map((a) => mapAppealRow(a, snippetMap)),
    total,
    page,
    pageSize,
  };
}

export async function listAdminAppeals(args: ListAppealsArgs): Promise<{
  items: AppealRow[];
  total: number;
  pendingTotal: number;
  page: number;
  pageSize: number;
}> {
  const pageSize = Math.max(1, Math.min(args.pageSize ?? 20, 50));
  const page = Math.max(1, args.page ?? 1);
  const status = args.status; // 默认全部
  const q = args.q?.trim();

  const where: Prisma.ContentAppealWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { targetId: { equals: q } },
            { appellant: { username: { contains: q, mode: "insensitive" } } },
            { appellant: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, pendingTotal, raw] = await Promise.all([
    prisma.contentAppeal.count({ where }),
    prisma.contentAppeal.count({ where: { status: "PENDING" } }),
    prisma.contentAppeal.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        appellant: APPELLANT_INCLUDE,
        reviewedBy: REVIEWER_INCLUDE,
      },
    }),
  ]);
  const snippetMap = await hydrateContentSnippets(raw);
  return {
    items: raw.map((a) => mapAppealRow(a, snippetMap)),
    total,
    pendingTotal,
    page,
    pageSize,
  };
}

/**
 * 给作者 UI 用：判断指定目标当前是否「可申诉」（已下架 + 作者 + 无 PENDING 申诉）。
 * 返回 'can-appeal' / 'pending' / 'rejected-but-can-retry' / 'denied-retry-limit'
 *      / 'no-content' / 'not-owner' / 'restored'
 */
export type AppealEligibility =
  | "can-appeal"
  | "pending"
  | "rejected-but-can-retry"
  | "denied-retry-limit"
  | "restored"
  | "no-content"
  | "not-owner";

export async function getAppealEligibility(
  targetType: ContentTargetType,
  targetId: string,
  viewerId: string,
): Promise<{
  state: AppealEligibility;
  target: AppealTargetSnapshot | null;
  appealId: string | null;
}> {
  // Note: target restored 状态下需要单独读，因为 getAppealTargetSnapshot 只在 deletedAt 非空时返回。
  switch (targetType) {
    case "POST": {
      const p = await prisma.post.findUnique({
        where: { id: targetId },
        select: { authorId: true, title: true, deletedAt: true, deletionReason: true },
      });
      if (!p) return { state: "no-content", target: null, appealId: null };
      if (p.authorId !== viewerId)
        return { state: "not-owner", target: null, appealId: null };
      if (!p.deletedAt)
        return { state: "restored", target: null, appealId: null };
      const t: AppealTargetSnapshot = {
        authorId: p.authorId,
        titleSnippet: p.title.slice(0, 120),
        deletedAt: p.deletedAt,
        deletionReason: p.deletionReason,
      };
      return computeAppealState(targetType, targetId, t);
    }
    case "WORK": {
      const w = await prisma.work.findUnique({
        where: { id: targetId },
        select: { authorId: true, title: true, deletedAt: true, deletionReason: true },
      });
      if (!w) return { state: "no-content", target: null, appealId: null };
      if (w.authorId !== viewerId)
        return { state: "not-owner", target: null, appealId: null };
      if (!w.deletedAt)
        return { state: "restored", target: null, appealId: null };
      const t: AppealTargetSnapshot = {
        authorId: w.authorId,
        titleSnippet: w.title.slice(0, 120),
        deletedAt: w.deletedAt,
        deletionReason: w.deletionReason,
      };
      return computeAppealState(targetType, targetId, t);
    }
    case "COMMENT": {
      const c = await prisma.comment.findUnique({
        where: { id: targetId },
        select: { authorId: true, content: true, deletedAt: true, deletionReason: true },
      });
      if (!c) return { state: "no-content", target: null, appealId: null };
      if (c.authorId !== viewerId)
        return { state: "not-owner", target: null, appealId: null };
      if (!c.deletedAt)
        return { state: "restored", target: null, appealId: null };
      const t: AppealTargetSnapshot = {
        authorId: c.authorId,
        titleSnippet: c.content.slice(0, 80),
        deletedAt: c.deletedAt,
        deletionReason: c.deletionReason,
      };
      return computeAppealState(targetType, targetId, t);
    }
    case "COLLABORATION": {
      const k = await prisma.collaboration.findUnique({
        where: { id: targetId },
        select: { authorId: true, title: true, deletedAt: true, deletionReason: true },
      });
      if (!k) return { state: "no-content", target: null, appealId: null };
      if (k.authorId !== viewerId)
        return { state: "not-owner", target: null, appealId: null };
      if (!k.deletedAt)
        return { state: "restored", target: null, appealId: null };
      const t: AppealTargetSnapshot = {
        authorId: k.authorId,
        titleSnippet: k.title.slice(0, 120),
        deletedAt: k.deletedAt,
        deletionReason: k.deletionReason,
      };
      return computeAppealState(targetType, targetId, t);
    }
  }
}

async function computeAppealState(
  targetType: ContentTargetType,
  targetId: string,
  target: AppealTargetSnapshot,
): Promise<{
  state: AppealEligibility;
  target: AppealTargetSnapshot;
  appealId: string | null;
}> {
  const [latest, rejectedCount] = await Promise.all([
    prisma.contentAppeal.findFirst({
      where: { targetType, targetId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true },
    }),
    prisma.contentAppeal.count({
      where: { targetType, targetId, status: "REJECTED" },
    }),
  ]);
  if (!latest) return { state: "can-appeal", target, appealId: null };
  if (latest.status === "PENDING")
    return { state: "pending", target, appealId: latest.id };
  // Stage 18.0：累计 REJECTED 达到上限后，前端直接展示「次数用尽」而非渲染表单。
  if (rejectedCount >= MAX_APPEAL_RETRY) {
    return { state: "denied-retry-limit", target, appealId: latest.id };
  }
  if (latest.status === "REJECTED")
    return { state: "rejected-but-can-retry", target, appealId: latest.id };
  // CANCELED 也可重新申诉
  return { state: "can-appeal", target, appealId: latest.id };
}

/** Single appeal detail for admin review dialog. */
export async function getAppealById(
  appealId: string,
): Promise<AppealRow | null> {
  const a = await prisma.contentAppeal.findUnique({
    where: { id: appealId },
    include: {
      appellant: APPELLANT_INCLUDE,
      reviewedBy: REVIEWER_INCLUDE,
    },
  });
  if (!a) return null;
  const snippetMap = await hydrateContentSnippets([
    { targetType: a.targetType, targetId: a.targetId },
  ]);
  return mapAppealRow(a, snippetMap);
}

/** Re-export type for callers (avoids deep import). */
export type { ContentTargetType } from "@/lib/content/schemas";

// Avoid unused import warning when ValidationError isn't used externally.
void ValidationError;
