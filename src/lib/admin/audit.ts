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
  // Stage 17.1
  | "CLAIM_REPORT"
  | "RELEASE_REPORT"
  // Stage 9 新增
  | "CREATE_TOOL"
  | "UPDATE_TOOL"
  | "UPDATE_COLLAB_STATUS"
  | "USER_ROLE_CHANGE"
  | "USER_STATUS_CHANGE"
  | "FORCE_LOGOUT_USER"
  | "POST_PIN"
  | "POST_UNPIN"
  | "POST_LOCK"
  | "POST_UNLOCK"
  // Stage 10.4 新增
  | "ORDER_REFUND_FULL"
  | "ORDER_REFUND_PARTIAL"
  // Stage 10.5 新增
  | "PAYOUT_MARK_PAID"
  // Stage 11.2 新增
  | "ORG_VERIFICATION_APPROVE"
  | "ORG_VERIFICATION_REJECT"
  // Stage 17.2 新增（软删除 + 申诉）
  | "SOFT_DELETE_POST"
  | "SOFT_DELETE_WORK"
  | "SOFT_DELETE_COLLAB"
  | "SOFT_DELETE_COMMENT"
  | "RESTORE_POST"
  | "RESTORE_WORK"
  | "RESTORE_COLLAB"
  | "RESTORE_COMMENT"
  | "APPEAL_APPROVE"
  | "APPEAL_REJECT"
  | (string & {});

/** Stage 9：audit-logs 页面下拉用的常用 action 列表（顺序即展示顺序）。 */
export const AUDIT_ACTIONS = [
  "DELETE_POST",
  "DELETE_WORK",
  "DELETE_COLLAB",
  "DELETE_TOOL",
  "DELETE_COMMENT",
  "CREATE_TOOL",
  "UPDATE_TOOL",
  "UPDATE_COLLAB_STATUS",
  "USER_ROLE_CHANGE",
  "USER_STATUS_CHANGE",
  "FORCE_LOGOUT_USER",
  "POST_PIN",
  "POST_UNPIN",
  "POST_LOCK",
  "POST_UNLOCK",
  "RESOLVE_REPORT",
  "DISMISS_REPORT",
  "CLAIM_REPORT",
  "RELEASE_REPORT",
  "ORDER_REFUND_FULL",
  "ORDER_REFUND_PARTIAL",
  "PAYOUT_MARK_PAID",
  "ORG_VERIFICATION_APPROVE",
  "ORG_VERIFICATION_REJECT",
  "SOFT_DELETE_POST",
  "SOFT_DELETE_WORK",
  "SOFT_DELETE_COLLAB",
  "SOFT_DELETE_COMMENT",
  "RESTORE_POST",
  "RESTORE_WORK",
  "RESTORE_COLLAB",
  "RESTORE_COMMENT",
  "APPEAL_APPROVE",
  "APPEAL_REJECT",
] as const satisfies readonly AuditAction[];

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  DELETE_POST: "删除帖子",
  DELETE_WORK: "删除作品",
  DELETE_COLLAB: "删除合作",
  DELETE_TOOL: "删除工具",
  DELETE_COMMENT: "删除评论",
  CREATE_TOOL: "新增工具",
  UPDATE_TOOL: "编辑工具",
  UPDATE_COLLAB_STATUS: "调整合作状态",
  USER_ROLE_CHANGE: "调整用户角色",
  USER_STATUS_CHANGE: "调整用户状态",
  FORCE_LOGOUT_USER: "强制下线用户",
  POST_PIN: "置顶帖子",
  POST_UNPIN: "取消置顶",
  POST_LOCK: "锁定帖子",
  POST_UNLOCK: "解锁帖子",
  RESOLVE_REPORT: "处理举报",
  DISMISS_REPORT: "驳回举报",
  CLAIM_REPORT: "认领举报",
  RELEASE_REPORT: "释放认领",
  ORDER_REFUND_FULL: "订单全额退款",
  ORDER_REFUND_PARTIAL: "订单部分退款",
  PAYOUT_MARK_PAID: "结算单标记打款",
  ORG_VERIFICATION_APPROVE: "通过企业认证",
  ORG_VERIFICATION_REJECT: "驳回企业认证",
  SOFT_DELETE_POST: "下架帖子",
  SOFT_DELETE_WORK: "下架作品",
  SOFT_DELETE_COLLAB: "下架合作",
  SOFT_DELETE_COMMENT: "下架评论",
  RESTORE_POST: "恢复帖子",
  RESTORE_WORK: "恢复作品",
  RESTORE_COLLAB: "恢复合作",
  RESTORE_COMMENT: "恢复评论",
  APPEAL_APPROVE: "通过申诉",
  APPEAL_REJECT: "驳回申诉",
};

export const AUDIT_TARGET_TYPES = [
  "Post",
  "Work",
  "Collaboration",
  "Tool",
  "Comment",
  "Report",
  "User",
  "Message",
  "Order",
  "Payout",
  "Organization",
  "ContentAppeal",
] as const;

export const AUDIT_TARGET_LABEL: Record<string, string> = {
  Post: "帖子",
  Work: "作品",
  Collaboration: "合作",
  Tool: "工具",
  Comment: "评论",
  Report: "举报",
  User: "用户",
  Message: "私信",
  Order: "订单",
  Payout: "结算单",
  Organization: "企业",
  ContentAppeal: "内容申诉",
};

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
