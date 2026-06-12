-- Stage 12.4：消息生命周期 + 通知聚合 + 系统消息
--
-- 变更：
--   仅新增 NotificationType 枚举值 GROUP_MESSAGE，把群聊消息通知与 1v1 MESSAGE 分流。
--   编辑 / 软删除 / SYSTEM 已经由 Stage 12.1 的 messages.type / messages.edited_at /
--   messages.deleted_at 列承载，无需再变更表结构。
--   conversation_participants.muted_until 字段也已在 12.1 铺好，本阶段直接读写。
--
-- 用 PG 9.6+ 原生的 `ADD VALUE IF NOT EXISTS` 保证可重跑；之前的 DO $$ + regtype 写法在
-- 大小写规范化下会查不到 NotificationType，反而引起首次部署失败。

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GROUP_MESSAGE';
