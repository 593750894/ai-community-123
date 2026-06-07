import { z } from "zod";

export const StartConversationSchema = z.object({
  targetUserId: z.string().min(1, "targetUserId 缺失"),
});

export const SendMessageSchema = z.object({
  conversationId: z.string().min(1, "conversationId 缺失"),
  content: z
    .string()
    .trim()
    .min(1, "消息不能为空")
    .max(4000, "消息最多 4000 个字符"),
});

export type StartConversationInput = z.infer<typeof StartConversationSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

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
