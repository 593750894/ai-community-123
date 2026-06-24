import { z } from "zod";

/**
 * Stage 17.2：软删除 + 申诉的 Zod 校验集中。
 * 仅可被软删除 + 申诉的 4 个实体类型在此固化。
 */

export const CONTENT_TARGET_TYPES = [
  "POST",
  "WORK",
  "COMMENT",
  "COLLABORATION",
] as const;
export type ContentTargetType = (typeof CONTENT_TARGET_TYPES)[number];

export const CONTENT_TARGET_LABEL: Record<ContentTargetType, string> = {
  POST: "帖子",
  WORK: "作品",
  COMMENT: "评论",
  COLLABORATION: "合作",
};

export const APPEAL_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELED",
] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

export const APPEAL_STATUS_LABEL: Record<AppealStatus, string> = {
  PENDING: "审核中",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  CANCELED: "已撤回",
};

/** MOD/ADMIN 下架内容时填写的原因。前端可选填，后端默认为空字符串视为未填。 */
export const SoftDeleteReasonSchema = z
  .string()
  .max(500, "原因不超过 500 字")
  .optional()
  .nullable();

/** 提交申诉 body schema。reason 必填，10-1000 字，便于审核人快速判断。 */
export const SubmitAppealSchema = z.object({
  targetType: z.enum(CONTENT_TARGET_TYPES),
  targetId: z.string().min(1).max(64),
  reason: z
    .string()
    .trim()
    .min(10, "申诉理由至少 10 字")
    .max(1000, "申诉理由不超过 1000 字"),
});
export type SubmitAppealInput = z.infer<typeof SubmitAppealSchema>;

/** Admin 审核申诉。REJECT 必须带备注，APPROVE 备注可选。 */
export const ReviewAppealSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reviewNote: z
      .string()
      .trim()
      .max(500, "备注不超过 500 字")
      .optional()
      .nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.decision === "REJECT") {
      const t = (v.reviewNote ?? "").trim();
      if (t.length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reviewNote"],
          message: "驳回时必须填写备注（至少 4 字）",
        });
      }
    }
  });
export type ReviewAppealInput = z.infer<typeof ReviewAppealSchema>;
