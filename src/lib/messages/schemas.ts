import { z } from "zod";

import { ALLOWED_MESSAGE_ATTACHMENT_MIME } from "@/lib/uploads/config";

export const StartConversationSchema = z.object({
  targetUserId: z.string().min(1, "targetUserId 缺失"),
});

// ─────────────────────────────────────────────────────────────
// Stage 12.3：消息附件 schema。
// 同一条消息最多 9 个附件（与微信对齐）；content 在带附件时可为空。
// 附件每条必须包含 url / name / mimeType / sizeBytes；image/video 可选带 width/height。
// ─────────────────────────────────────────────────────────────

export const MESSAGE_ATTACHMENT_MAX_COUNT = 9;
export const MESSAGE_CONTENT_MAX = 4000;
export const ATTACHMENT_NAME_MAX = 200;
export const ATTACHMENT_URL_MAX = 2048;

const ALLOWED_ATTACHMENT_MIMES = Object.keys(ALLOWED_MESSAGE_ATTACHMENT_MIME);

export const MessageAttachmentSchema = z.object({
  url: z
    .string()
    .trim()
    .url("附件 URL 非法")
    .max(ATTACHMENT_URL_MAX, "附件 URL 过长"),
  name: z
    .string()
    .trim()
    .min(1, "附件名不能为空")
    .max(ATTACHMENT_NAME_MAX, "附件名过长"),
  mimeType: z
    .string()
    .trim()
    .max(120)
    .refine((m) => ALLOWED_ATTACHMENT_MIMES.includes(m), "附件 MIME 不在白名单"),
  sizeBytes: z
    .number()
    .int("文件大小必须为整数")
    .positive("文件大小无效")
    .max(200 * 1024 * 1024, "文件超过 200MB 上限"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const MessageContentSchema = z
  .string()
  .trim()
  .max(MESSAGE_CONTENT_MAX, `消息最多 ${MESSAGE_CONTENT_MAX} 个字符`);

export const SendMessageSchema = z
  .object({
    conversationId: z.string().min(1, "conversationId 缺失"),
    content: MessageContentSchema.default(""),
    attachments: z
      .array(MessageAttachmentSchema)
      .max(
        MESSAGE_ATTACHMENT_MAX_COUNT,
        `单条消息最多 ${MESSAGE_ATTACHMENT_MAX_COUNT} 个附件`,
      )
      .default([]),
  })
  .superRefine((val, ctx) => {
    if (val.content.length === 0 && val.attachments.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "消息或附件至少需要一项",
        path: ["content"],
      });
    }
  });

export type StartConversationInput = z.infer<typeof StartConversationSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type MessageAttachmentInput = z.infer<typeof MessageAttachmentSchema>;

// ─────────────────────────────────────────────────────────────
// Stage 12.2：群聊 CRUD + 成员管理
// ─────────────────────────────────────────────────────────────

/** 群聊默认人数上限，包含群主在内。 */
export const GROUP_DEFAULT_MEMBER_LIMIT = 100;
/** 群名最小 / 最大长度。 */
export const GROUP_TITLE_MIN = 2;
export const GROUP_TITLE_MAX = 60;
/** 创建时除自己外至少邀请 2 人（即总人数 ≥ 3，与 1v1 显式区分）。 */
export const GROUP_CREATE_MIN_INVITES = 2;
/** 单次添加成员的批量上限，避免 PSP 端 N+1 / 通知风暴。 */
export const GROUP_ADD_BATCH_MAX = 50;

const TitleField = z
  .string()
  .trim()
  .min(GROUP_TITLE_MIN, `群名至少 ${GROUP_TITLE_MIN} 个字符`)
  .max(GROUP_TITLE_MAX, `群名最多 ${GROUP_TITLE_MAX} 个字符`);

const AvatarUrlField = z
  .union([
    z.literal("").transform(() => null),
    z.string().trim().url("头像必须是合法 URL").max(2048),
    z.null(),
  ])
  .optional();

const UniqueUserIds = (min: number, max: number) =>
  z
    .array(z.string().trim().min(1).max(64))
    .min(min, `至少需要 ${min} 个成员`)
    .max(max, `单次最多 ${max} 个成员`)
    .transform((ids) => Array.from(new Set(ids)));

/** 群聊 / 1v1 共用入口 schema。isGroup=false 时按 1v1 旧字段；true 时按群聊字段。 */
export const CreateConversationSchema = z.discriminatedUnion("isGroup", [
  z.object({
    isGroup: z.literal(false),
    targetUserId: z.string().min(1, "targetUserId 缺失"),
  }),
  z.object({
    isGroup: z.literal(true),
    title: TitleField,
    avatarUrl: AvatarUrlField,
    memberIds: UniqueUserIds(
      GROUP_CREATE_MIN_INVITES,
      GROUP_DEFAULT_MEMBER_LIMIT - 1,
    ),
  }),
]);

export const UpdateGroupConversationSchema = z
  .object({
    title: TitleField.optional(),
    avatarUrl: AvatarUrlField,
  })
  .refine((v) => v.title !== undefined || v.avatarUrl !== undefined, {
    message: "请至少修改一个字段",
  });

export const AddGroupMembersSchema = z.object({
  memberIds: UniqueUserIds(1, GROUP_ADD_BATCH_MAX),
});

/** 群成员角色更新：只允许 OWNER ↔ ADMIN/MEMBER 之间切换；OWNER 不通过此接口分配。 */
export const UpdateGroupMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
export type UpdateGroupConversationInput = z.infer<
  typeof UpdateGroupConversationSchema
>;
export type AddGroupMembersInput = z.infer<typeof AddGroupMembersSchema>;
export type UpdateGroupMemberRoleInput = z.infer<
  typeof UpdateGroupMemberRoleSchema
>;
