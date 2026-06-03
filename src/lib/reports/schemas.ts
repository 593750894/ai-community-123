import { z } from "zod";

/**
 * 举报系统的 Zod 校验。
 *
 * Report.reason 在 Prisma 里是 string，不绑死到枚举——后续运营加新原因不需要迁移；
 * 但在 API 层用枚举校验，避免任意字符串注入。
 */

export const REPORT_REASONS = [
  "SPAM",        // 垃圾营销 / 刷屏
  "HARASSMENT",  // 骚扰 / 攻击 / 仇恨
  "NSFW",        // 色情 / 软色情 / 血腥
  "COPYRIGHT",   // 侵权 / 抄袭
  "MISINFO",     // 虚假信息 / 误导
  "OTHER",       // 其他（建议在 description 里写明）
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  SPAM: "垃圾营销 / 刷屏",
  HARASSMENT: "骚扰 / 攻击 / 仇恨言论",
  NSFW: "色情 / 暴力 / 血腥",
  COPYRIGHT: "侵权 / 抄袭",
  MISINFO: "虚假信息 / 误导",
  OTHER: "其他",
};

export const REPORT_TARGET_TYPES = [
  "USER",
  "POST",
  "COMMENT",
  "WORK",
  "COLLABORATION",
  "MESSAGE",
  "TOOL",
] as const;

export type ReportTargetTypeValue = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_TARGET_LABEL: Record<ReportTargetTypeValue, string> = {
  USER: "用户",
  POST: "帖子",
  COMMENT: "评论",
  WORK: "作品",
  COLLABORATION: "合作需求",
  MESSAGE: "私信",
  TOOL: "工具",
};

export const REPORT_STATUSES = [
  "PENDING",
  "REVIEWING",
  "RESOLVED",
  "DISMISSED",
] as const;

export type ReportStatusValue = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABEL: Record<ReportStatusValue, string> = {
  PENDING: "待处理",
  REVIEWING: "审核中",
  RESOLVED: "已处理",
  DISMISSED: "已驳回",
};

export const CreateReportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z
    .string()
    .min(1, "targetId 缺失")
    .max(64, "targetId 不合法"),
  reason: z.enum(REPORT_REASONS),
  description: z
    .string()
    .trim()
    .max(500, "补充说明最多 500 字")
    .optional(),
});

export type CreateReportInput = z.infer<typeof CreateReportSchema>;

export const ResolveReportSchema = z
  .object({
    status: z.enum(["RESOLVED", "DISMISSED"]),
    resolution: z
      .string()
      .trim()
      .max(500, "处理意见最多 500 字")
      .optional(),
    deleteTarget: z.boolean().optional(),
  })
  .refine(
    (data) => !(data.status === "DISMISSED" && data.deleteTarget),
    { message: "驳回时不应同时删除目标", path: ["deleteTarget"] },
  );

export type ResolveReportInput = z.infer<typeof ResolveReportSchema>;

export const ListReportsQuerySchema = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  targetType: z.enum(REPORT_TARGET_TYPES).optional(),
});

export type ListReportsQuery = z.infer<typeof ListReportsQuerySchema>;
