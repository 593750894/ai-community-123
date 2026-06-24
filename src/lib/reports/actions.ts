import { prisma } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { AppError } from "@/lib/errors";
import { createAuditLog } from "@/lib/admin/audit";
import { notifyAdminsOfReport } from "@/lib/notifications/emit-report";
import {
  softDeleteContentByTarget,
} from "@/lib/content/soft-delete";
import type { ContentTargetType } from "@/lib/content/schemas";

import type {
  CreateReportInput,
  ReportTargetTypeValue,
  ResolveReportInput,
} from "@/lib/reports/schemas";

/**
 * 举报系统的 server-side 业务逻辑。
 *
 * 设计取舍：
 * - 自举报 / 重复举报（已有 PENDING/REVIEWING） / 1h 内 >20 条 → 业务级拒绝，不走 DB unique。
 *   (Postgres 没有原生 partial unique 让 Prisma 友好生成；count() 也够用，等量大了再换 Upstash 边缘限流)
 * - 目标不存在 → 404。
 * - Admin 处理时可选 deleteTarget，会调用对应 adminDeleteXxx 并写 AuditLog。
 */

const HOURLY_REPORT_CAP = 20;
const HOUR_MS = 60 * 60 * 1000;

class TooManyReportsError extends AppError {
  constructor() {
    super("举报频率过高，请稍后再试", "RATE_LIMITED", 429);
    this.name = "TooManyReportsError";
  }
}

/**
 * 目标当前所有者 ID（用于自举报检查）。
 * 找不到目标返回 null（调用方转 404）。
 */
async function getTargetOwnerId(
  targetType: ReportTargetTypeValue,
  targetId: string,
): Promise<string | null | undefined> {
  switch (targetType) {
    case "USER": {
      const u = await prisma.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      return u ? u.id : null;
    }
    case "POST": {
      const p = await prisma.post.findUnique({
        where: { id: targetId },
        select: { authorId: true },
      });
      return p ? p.authorId : null;
    }
    case "COMMENT": {
      const c = await prisma.comment.findUnique({
        where: { id: targetId },
        select: { authorId: true },
      });
      return c ? c.authorId : null;
    }
    case "WORK": {
      const w = await prisma.work.findUnique({
        where: { id: targetId },
        select: { authorId: true },
      });
      return w ? w.authorId : null;
    }
    case "COLLABORATION": {
      const k = await prisma.collaboration.findUnique({
        where: { id: targetId },
        select: { authorId: true },
      });
      return k ? k.authorId : null;
    }
    case "MESSAGE": {
      const m = await prisma.message.findUnique({
        where: { id: targetId },
        select: { senderId: true },
      });
      return m ? m.senderId : null;
    }
    case "TOOL": {
      const t = await prisma.tool.findUnique({
        where: { id: targetId },
        select: { createdById: true },
      });
      return t ? t.createdById : null;
    }
    default:
      return undefined;
  }
}

export async function createReport(
  input: CreateReportInput,
  reporterId: string,
): Promise<{ id: string; status: "PENDING" }> {
  // 1) 频率限制（小时级）
  const since = new Date(Date.now() - HOUR_MS);
  const recentCount = await prisma.report.count({
    where: { reporterId, createdAt: { gte: since } },
  });
  if (recentCount >= HOURLY_REPORT_CAP) throw new TooManyReportsError();

  // 2) 目标存在 + 自举报检查
  const ownerId = await getTargetOwnerId(input.targetType, input.targetId);
  if (ownerId === undefined) throw new ValidationError("不支持的目标类型");
  if (ownerId === null) throw new NotFoundError("举报目标");
  if (ownerId === reporterId) {
    throw new ForbiddenError("不能举报自己的内容");
  }

  // 3) 同一目标已有未结举报 → 409；与 4) 一起走事务，避免双击/并发产生重复 PENDING
  const report = await prisma.$transaction(async (tx) => {
    const open = await tx.report.findFirst({
      where: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        status: { in: ["PENDING", "REVIEWING"] },
      },
      select: { id: true },
    });
    if (open) throw new ConflictError("你已经举报过该目标，正在处理中");
    return tx.report.create({
      data: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        description: input.description ?? null,
        status: "PENDING",
      },
      select: { id: true },
    });
  });

  // 5) 通知 admin（不阻塞）
  await notifyAdminsOfReport({
    reportId: report.id,
    reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
  });

  return { id: report.id, status: "PENDING" };
}

/** 处理举报：RESOLVED / DISMISSED + 可选下架目标（Stage 17.2 改为软删除）。
 *
 *  软删除不再需要跨表事务——softDeleteContentByTarget 是 single-row update + tx within，
 *  和 report.update 独立。先软删除再更新 report，任一失败都不会让 report 错误地标 RESOLVED。
 *
 *  AuditLog + 通知 fire-and-forget，落不上不阻塞主流程。
 */
export async function adminResolveReport(
  reportId: string,
  payload: ResolveReportInput,
  adminId: string,
): Promise<void> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      status: true,
    },
  });
  if (!report) throw new NotFoundError("举报");
  if (report.status !== "PENDING" && report.status !== "REVIEWING") {
    throw new ConflictError("该举报已处理过");
  }

  const targetType = report.targetType as ReportTargetTypeValue;
  let extraMeta: Record<string, unknown> = {};

  // Stage 17.2：先执行软删除（report 路径只对 4 个内容类型生效；其它如 USER/TOOL/MESSAGE 跳过）。
  if (payload.status === "RESOLVED" && payload.deleteTarget) {
    const contentType = reportTargetToContentTarget(targetType);
    if (contentType) {
      const result = await softDeleteContentByTarget(
        contentType,
        report.targetId,
        {
          actorId: adminId,
          reason: payload.resolution ?? null,
          source: "report",
        },
      );
      extraMeta = {
        deletedTarget: result.ok,
        deleteAction: result.action,
      };
    } else {
      // USER / TOOL / MESSAGE 暂不接软删除（USER 走禁言/封禁；TOOL/MESSAGE 走单独路径）。
      extraMeta = { deletedTarget: false, deleteAction: null };
    }
  }

  // 再更新 report 状态——拿到下架结果后再 finalize，避免 report 标 RESOLVED 但下架失败的悬挂态。
  const { count } = await prisma.report.updateMany({
    where: {
      id: reportId,
      status: { in: ["PENDING", "REVIEWING"] },
    },
    data: {
      status: payload.status,
      resolvedById: adminId,
      resolvedAt: new Date(),
      resolution: payload.resolution ?? null,
      // Stage 17.1：结案时清空认领信息。
      assignedToId: null,
      assignedAt: null,
    },
  });
  if (count === 0) throw new ConflictError("该举报状态已变更");

  // 1) 主 AuditLog（举报本身的处理结果）
  await createAuditLog({
    adminId,
    action: payload.status === "RESOLVED" ? "RESOLVE_REPORT" : "DISMISS_REPORT",
    targetType: "Report",
    targetId: reportId,
    metadata: {
      reportTargetType: report.targetType,
      reportTargetId: report.targetId,
      resolution: payload.resolution ?? null,
      ...extraMeta,
    },
  });
  // 2) 下架目标的 AuditLog 已在 softDeleteContentByTarget 内部落，无需重复写。
}

/** 将 ReportTargetType 映射到可软删除的 ContentTargetType；不支持的返回 null。 */
function reportTargetToContentTarget(
  t: ReportTargetTypeValue,
): ContentTargetType | null {
  switch (t) {
    case "POST":
      return "POST";
    case "WORK":
      return "WORK";
    case "COMMENT":
      return "COMMENT";
    case "COLLABORATION":
      return "COLLABORATION";
    default:
      return null;
  }
}


/**
 * Stage 17.1：审核员认领举报。PENDING → REVIEWING + assignedToId=modId。
 *
 * 并发安全：用 updateMany WHERE status=PENDING AND assignedToId IS NULL，
 * 拿到 count=0 表示已被别的 MOD 抢先认领或已结案，外层抛 409。
 * 同一个 mod 认领自己已认领的 case → updateMany 也会返回 0（status 已是 REVIEWING），
 * 业务上无害（前端按钮不会再出现）。
 */
export async function adminClaimReport(
  reportId: string,
  modId: string,
): Promise<void> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, assignedToId: true },
  });
  if (!report) throw new NotFoundError("举报");
  if (report.status !== "PENDING") {
    throw new ConflictError("该举报已被认领或已结案");
  }

  const { count } = await prisma.report.updateMany({
    where: { id: reportId, status: "PENDING", assignedToId: null },
    data: {
      status: "REVIEWING",
      assignedToId: modId,
      assignedAt: new Date(),
    },
  });
  if (count === 0) throw new ConflictError("该举报已被认领或已结案");

  await createAuditLog({
    adminId: modId,
    action: "CLAIM_REPORT",
    targetType: "Report",
    targetId: reportId,
    metadata: { previousStatus: "PENDING" },
  });
}

/**
 * Stage 17.1：审核员释放认领。REVIEWING → PENDING + 清空 assignedToId。
 *
 * 仅认领者本人 / ADMIN 可释放（MOD 不能抢别人的 case）。
 * 已结案的 case 不可释放。
 */
export async function adminReleaseReport(
  reportId: string,
  actor: { id: string; role: string },
): Promise<void> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, assignedToId: true },
  });
  if (!report) throw new NotFoundError("举报");
  if (report.status !== "REVIEWING") {
    throw new ConflictError("仅可释放审核中的举报");
  }
  const isOwner = report.assignedToId === actor.id;
  const isAdminActor = actor.role === "ADMIN";
  if (!isOwner && !isAdminActor) {
    throw new ForbiddenError("仅认领者或 ADMIN 可释放");
  }

  const { count } = await prisma.report.updateMany({
    where: { id: reportId, status: "REVIEWING" },
    data: {
      status: "PENDING",
      assignedToId: null,
      assignedAt: null,
    },
  });
  if (count === 0) throw new ConflictError("举报状态已变更");

  await createAuditLog({
    adminId: actor.id,
    action: "RELEASE_REPORT",
    targetType: "Report",
    targetId: reportId,
    metadata: { previousAssignee: report.assignedToId },
  });
}

