import { z } from "zod";
import type { OrgRole } from "@/generated/prisma/client";

// Stage 11.1：企业模块的所有 Zod 校验集中地。client-safe（不依赖 prisma 客户端实例）。

export const ORG_INDUSTRIES = [
  "FILM",
  "GAME",
  "ADVERTISING",
  "SELF_MEDIA",
  "EDUCATION",
  "OTHER",
] as const;
export type OrgIndustry = (typeof ORG_INDUSTRIES)[number];

export const ORG_INDUSTRY_LABEL: Record<OrgIndustry, string> = {
  FILM: "影视",
  GAME: "游戏",
  ADVERTISING: "广告 / 营销",
  SELF_MEDIA: "自媒体",
  EDUCATION: "教育 / 培训",
  OTHER: "其他",
};

export const ORG_SIZES = ["1-10", "11-50", "51-200", "201+"] as const;
export type OrgSize = (typeof ORG_SIZES)[number];

// 企业邀请仅允许设为 MEMBER / ADMIN，OWNER 由创建者持有不可邀请。
export const INVITE_ASSIGNABLE_ROLES = ["MEMBER", "ADMIN"] as const satisfies readonly OrgRole[];
export type InviteAssignableRole = (typeof INVITE_ASSIGNABLE_ROLES)[number];

export const ORG_ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: "所有者",
  ADMIN: "管理员",
  MEMBER: "成员",
};

export const ORG_INVITE_STATUS_LABEL = {
  PENDING: "待响应",
  ACCEPTED: "已接受",
  REJECTED: "已拒绝",
  CANCELED: "已撤销",
} as const;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const URL_OR_EMPTY = z
  .string()
  .max(200)
  .optional()
  .transform((v) => (v ? v.trim() : ""))
  .refine((v) => v === "" || /^https?:\/\//i.test(v), {
    message: "请输入合法的 http(s) 链接",
  });

export const CreateOrganizationSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(64)
    .regex(SLUG_RE, "slug 仅允许小写字母 / 数字 / 连字符，首尾非连字符"),
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().transform((v) => v?.trim() || null),
  logo: z.string().url().max(500).optional().or(z.literal("")).transform((v) => v || null),
  website: URL_OR_EMPTY.transform((v) => v || null),
  industry: z.enum(ORG_INDUSTRIES).optional().nullable(),
  size: z.enum(ORG_SIZES).optional().nullable(),
  contactEmail: z
    .string()
    .email()
    .max(200)
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
});
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial().omit({
  slug: true,
});
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;

export const InviteMemberSchema = z.object({
  inviteeUsername: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, "用户名仅允许字母 / 数字 / 下划线 / 连字符"),
  role: z.enum(INVITE_ASSIGNABLE_ROLES),
  message: z.string().max(200).optional().transform((v) => v?.trim() || null),
});
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(INVITE_ASSIGNABLE_ROLES), // 不能把现有 OWNER 改成别的（业务层另查）
});

export const RespondInviteSchema = z.object({
  action: z.enum(["accept", "reject"]),
});

// Stage 11.2 · 企业认证 ─────────────────────────────────────────

export const ORG_VERIFICATION_STATUSES = [
  "NONE",
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export type OrgVerificationStatusValue = (typeof ORG_VERIFICATION_STATUSES)[number];

export const ORG_VERIFICATION_STATUS_LABEL: Record<OrgVerificationStatusValue, string> = {
  NONE: "未提交",
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回",
};

// 统一社会信用代码 18 位（合规格式），但保留旧版工商注册号兼容。
// 这里不做严格 GB 32100 校验，仅长度与字符限制；admin 人工复核。
const REG_NO_RE = /^[A-Za-z0-9]{8,30}$/;
const URL_RE = /^https?:\/\/.+/i;

export const SubmitVerificationSchema = z.object({
  name: z.string().min(2).max(120),
  regNo: z
    .string()
    .regex(REG_NO_RE, "统一社会信用代码 / 注册号格式不正确"),
  rep: z.string().min(2).max(60),
  licenseUrl: z
    .string()
    .regex(URL_RE, "请上传营业执照图片并填写其 URL"),
  contact: z.string().min(3).max(120),
  note: z.string().max(500).optional().transform((v) => v?.trim() || null),
});
export type SubmitVerificationInput = z.infer<typeof SubmitVerificationSchema>;

export const ReviewVerificationSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    note: z.string().max(500).optional().transform((v) => v?.trim() || ""),
  })
  .superRefine((val, ctx) => {
    if (val.decision === "REJECT" && !val.note) {
      ctx.addIssue({
        path: ["note"],
        code: z.ZodIssueCode.custom,
        message: "驳回必须填写原因",
      });
    }
  });
export type ReviewVerificationInput = z.infer<typeof ReviewVerificationSchema>;
