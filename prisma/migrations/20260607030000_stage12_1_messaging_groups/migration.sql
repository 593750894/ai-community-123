-- Stage 12.1：群聊 + 消息附件基础设施（无新 UI / API）
--
-- 变更：
--   1. 新 enum ConversationRole (OWNER/ADMIN/MEMBER) + MessageType (TEXT/IMAGE/FILE/SYSTEM)
--   2. conversations 加群聊扩展字段：is_group / title / avatar_url / owner_id / member_limit；
--      + (is_group, last_message_at) 复合索引；owner_id FK→users(id) ON DELETE SET NULL。
--   3. conversation_participants 加群聊角色：role / muted_until。
--   4. messages 加 type / attachments / edited_at / deleted_at。
--
-- 全部 IF NOT EXISTS / DO $$ 包 ADD VALUE / CREATE TYPE / pg_constraint，沿用 11.x 幂等模式。
-- 注：1v1 已有会话保留 is_group=false，所有 participant 默认 role=MEMBER；
--    不强制 owner_id（1v1 无群主语义）。

-- ── 1. enum ConversationRole ─────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationRole') THEN
    CREATE TYPE "ConversationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
  END IF;
END $$;

-- ── 2. enum MessageType ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageType') THEN
    CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'SYSTEM');
  END IF;
END $$;

-- ── 3. conversations：群聊扩展字段 ────────────────────────────────
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "is_group"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "title"        TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "avatar_url"   TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "owner_id"     TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "member_limit" INTEGER NOT NULL DEFAULT 2;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_owner_id_fkey'
  ) THEN
    ALTER TABLE "conversations"
      ADD CONSTRAINT "conversations_owner_id_fkey"
      FOREIGN KEY ("owner_id") REFERENCES "users"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "conversations_is_group_last_message_at_idx"
  ON "conversations" ("is_group", "last_message_at");

-- ── 4. conversation_participants：角色 + 免打扰 ──────────────────
ALTER TABLE "conversation_participants"
  ADD COLUMN IF NOT EXISTS "role" "ConversationRole" NOT NULL DEFAULT 'MEMBER';

ALTER TABLE "conversation_participants"
  ADD COLUMN IF NOT EXISTS "muted_until" TIMESTAMP(3);

-- ── 5. messages：类型 / 附件 / 编辑 / 删除 ────────────────────────
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "type" "MessageType" NOT NULL DEFAULT 'TEXT';

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachments" JSONB;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "edited_at"   TIMESTAMP(3);
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deleted_at"  TIMESTAMP(3);
