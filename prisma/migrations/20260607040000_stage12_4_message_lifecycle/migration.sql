-- Stage 12.4：消息生命周期 + 通知聚合 + 系统消息
--
-- 变更：
--   仅新增 NotificationType 枚举值 GROUP_MESSAGE，把群聊消息通知与 1v1 MESSAGE 分流。
--   编辑 / 软删除 / SYSTEM 已经由 Stage 12.1 的 messages.type / messages.edited_at /
--   messages.deleted_at 列承载，无需再变更表结构。
--   conversation_participants.muted_until 字段也已在 12.1 铺好，本阶段直接读写。
--
-- 沿用 11.x / 12.x 幂等模式（DO $$ 包 ADD VALUE），可重跑安全。

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'GROUP_MESSAGE'
      AND enumtypid = 'NotificationType'::regtype
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'GROUP_MESSAGE';
  END IF;
END $$;
