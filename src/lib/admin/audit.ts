import { prisma } from "@/lib/db";
import { getClientMeta } from "@/lib/admin/get-client-meta";

/**
 * AuditLog 写入助手。所有管理员变更入口（删帖 / 处理举报 / 删评论 / 改角色…）
 * 都应在动作落库后调用本函数。
 *
 * 设计约束：
 * - 失败必须吞掉。审计落不上不能拖垮主流程。
 * - action 一律大写下划线（schema 注释要求）。常用值集中在 AuditAction 联合类型，
 *   但 string 也允许，便于追加新动作时不绕一圈。
 */

export type AuditAction =
  | "DELETE_POST"
  | "DELETE_WORK"
  | "DELETE_COLLAB"
  | "DELETE_TOOL"
  | "DELETE_COMMENT"
  | "RESOLVE_REPORT"
  | "DISMISS_REPORT"
  | "REVIEW_REPORT"
  | (string & {});

export interface CreateAuditLogInput {
  adminId: string;
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  try {
    const { ip, userAgent } = await getClientMeta();
    await prisma.auditLog.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ? (input.metadata as object) : undefined,
        ip,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[audit] createAuditLog failed", err);
  }
}
