import { prisma } from "@/lib/db";
import { emitNotification } from "@/lib/notifications/emit";
import { REPORT_TARGET_LABEL, REPORT_REASON_LABEL } from "@/lib/reports/schemas";
import type { ReportReason, ReportTargetTypeValue } from "@/lib/reports/schemas";

/**
 * 新举报 fan-out 到所有 ADMIN。
 *
 * 用 SYSTEM 类型而非新增 REPORT_RECEIVED 枚举值，避免 Postgres ALTER TYPE
 * 在 tx 外执行带来的迁移复杂度（前端 notification-list 已为 SYSTEM 准备好图标）。
 * 失败必须吞掉，举报落盘是第一要务。
 */
export async function notifyAdminsOfReport(args: {
  reportId: string;
  reporterId: string;
  targetType: ReportTargetTypeValue;
  targetId: string;
  reason: ReportReason;
}): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
    const reasonLabel = REPORT_REASON_LABEL[args.reason] ?? args.reason;
    const targetLabel =
      REPORT_TARGET_LABEL[args.targetType] ?? args.targetType;
    const title = `新举报：${targetLabel}（${reasonLabel}）`;
    const link = `/admin/reports?status=PENDING`;
    await Promise.all(
      admins.map((admin) =>
        emitNotification({
          recipientId: admin.id,
          // 安全：举报人身份不通过通知 actor 暴露给 admin（防止 admin 被有心人钓鱼/打击报复）；
          // admin 进入 /admin/reports 才看得到 reporter，那一层有完整 audit。
          actorId: null,
          type: "SYSTEM",
          title,
          body: `目标 ID ${args.targetId.slice(0, 8)}…，请尽快处理。`,
          link,
          targetType: "Report",
          targetId: args.reportId,
        }),
      ),
    );
  } catch (err) {
    console.error("[notifications] notifyAdminsOfReport", err);
  }
}
