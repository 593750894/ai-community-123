import { prisma, Prisma } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { AppError } from "@/lib/errors";
import { createAuditLog } from "@/lib/admin/audit";
import { notifyAdminsOfReport } from "@/lib/notifications/emit-report";

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

/** 处理举报：RESOLVED / DISMISSED + 可选删除目标。
 *  原子性：deleteTarget + status update 一起走事务，任何一步失败都回滚。
 *  AuditLog 不在事务里（落不上不阻塞主流程）。
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

  await prisma.$transaction(
    async (tx) => {
      if (payload.status === "RESOLVED" && payload.deleteTarget) {
        const result = await deleteReportTargetInTx(tx, {
          targetType,
          targetId: report.targetId,
        });
        extraMeta = {
          deletedTarget: result.deleted,
          deleteAction: result.action,
        };
      }
      await tx.report.update({
        where: { id: reportId },
        data: {
          status: payload.status,
          resolvedById: adminId,
          resolvedAt: new Date(),
          resolution: payload.resolution ?? null,
        },
      });
    },
    { timeout: 15_000 },
  );

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
  // 2) 删除目标的 AuditLog（便于在 /admin/audit-logs 上按 targetType=Post 等检索）
  if (extraMeta.deletedTarget && extraMeta.deleteAction) {
    await createAuditLog({
      adminId,
      action: String(extraMeta.deleteAction),
      targetType: targetTypeToAuditLabel(targetType),
      targetId: report.targetId,
      metadata: { reportId, source: "report" },
    });
  }
}

function targetTypeToAuditLabel(t: ReportTargetTypeValue): string {
  switch (t) {
    case "POST": return "Post";
    case "WORK": return "Work";
    case "COLLABORATION": return "Collaboration";
    case "COMMENT": return "Comment";
    case "TOOL": return "Tool";
    case "USER": return "User";
    case "MESSAGE": return "Message";
    default: return t;
  }
}

/** 事务内执行删除。switch 与 adminDeleteReportTarget 同形，但不落 audit（外层落）。 */
async function deleteReportTargetInTx(
  tx: Prisma.TransactionClient,
  args: { targetType: ReportTargetTypeValue; targetId: string },
): Promise<{ deleted: boolean; action: string | null }> {
  const { targetType, targetId } = args;
  switch (targetType) {
    case "POST": {
      const post = await tx.post.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!post) return { deleted: false, action: null };
      await tx.post.delete({ where: { id: targetId } });
      return { deleted: true, action: "DELETE_POST" };
    }
    case "WORK": {
      const work = await tx.work.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!work) return { deleted: false, action: null };
      await tx.work.delete({ where: { id: targetId } });
      return { deleted: true, action: "DELETE_WORK" };
    }
    case "COLLABORATION": {
      const collab = await tx.collaboration.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!collab) return { deleted: false, action: null };
      await tx.collaboration.delete({ where: { id: targetId } });
      return { deleted: true, action: "DELETE_COLLAB" };
    }
    case "COMMENT": {
      const c = await tx.comment.findUnique({
        where: { id: targetId },
        select: { id: true, postId: true },
      });
      if (!c) return { deleted: false, action: null };
      await tx.comment.delete({ where: { id: targetId } });
      await tx.post.update({
        where: { id: c.postId },
        data: { commentCount: { decrement: 1 } },
      });
      return { deleted: true, action: "DELETE_COMMENT" };
    }
    case "TOOL": {
      const t = await tx.tool.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!t) return { deleted: false, action: null };
      await tx.tool.delete({ where: { id: targetId } });
      return { deleted: true, action: "DELETE_TOOL" };
    }
    case "USER":
    case "MESSAGE":
    default:
      return { deleted: false, action: null };
  }
}
