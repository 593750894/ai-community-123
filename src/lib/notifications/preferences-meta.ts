import type { NotificationType } from "@/generated/prisma/client";

// Stage 9：client-safe 通知元数据。这个文件**不能**导入 prisma / server-only 代码，
// 否则会被 next 拉进 client bundle。所有 DB 函数都在 preferences.ts。

export const NOTIFICATION_TYPES = [
  "POST_REPLY",
  "COMMENT_REPLY",
  "POST_LIKE",
  "WORK_LIKE",
  "COMMENT_LIKE",
  "BOOKMARK",
  "MENTION",
  "FOLLOW",
  "COLLAB_REPLY",
  "MESSAGE",
  "SYSTEM",
] as const satisfies readonly NotificationType[];

export type GateableNotificationType = Exclude<NotificationType, "SYSTEM">;

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  POST_REPLY: "有人评论了我的帖子",
  COMMENT_REPLY: "有人回复了我的评论",
  POST_LIKE: "有人赞了我的帖子",
  WORK_LIKE: "有人赞了我的作品",
  COMMENT_LIKE: "有人赞了我的评论",
  BOOKMARK: "有人收藏了我的内容",
  MENTION: "有人 @ 了我",
  FOLLOW: "有人关注了我",
  COLLAB_REPLY: "我的合作需求收到回应",
  MESSAGE: "我收到了私信",
  SYSTEM: "系统 / 管理员通知",
};

export const NOTIFICATION_TYPE_DESCRIPTION: Record<NotificationType, string> = {
  POST_REPLY: "新评论会推送一次（同一人 24h 内去重）。",
  COMMENT_REPLY: "回复你的评论会单独推送给你。",
  POST_LIKE: "同一人 24 小时内不会重复推送。",
  WORK_LIKE: "同一人 24 小时内不会重复推送。",
  COMMENT_LIKE: "同一人 24 小时内不会重复推送。",
  BOOKMARK: "同一人 24 小时内不会重复推送。",
  MENTION: "在帖子 / 评论中被 @ 时推送。",
  FOLLOW: "有人开始关注你时推送。",
  COLLAB_REPLY: "有人回复你的合作发布时推送。",
  MESSAGE: "新私信即推；会话内已读后不会重复提醒。",
  SYSTEM: "举报处理、强制下线等运维通知，无法关闭。",
};

/** SYSTEM 不能关；UI 端禁用 toggle，并在服务端忽略对应的 upsert。 */
export function isGateable(t: NotificationType): t is GateableNotificationType {
  return t !== "SYSTEM";
}

export type PreferenceMap = Record<NotificationType, boolean>;
