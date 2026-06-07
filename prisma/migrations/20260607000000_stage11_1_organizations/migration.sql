-- Stage 11.1：Organization 基础 + 成员 + 邀请
--
-- 变更：
--   1. NotificationType 追加 ORG_INVITE / ORG_INVITE_RESPONSE / ORG_MEMBER_REMOVED（DO 包 ADD VALUE 防重跑）
--   2. 新 enum OrgInviteStatus (PENDING / ACCEPTED / REJECTED / CANCELED)
--   3. organizations 表追加 owner_id / industry / size / contact_email
--   4. 新表 organization_invites
--   5. 部分唯一索引：同一组织 + 同一被邀请人，最多一条 PENDING（Prisma 不支持部分唯一，走 raw SQL）
--
-- 全部使用 IF NOT EXISTS / DO $$ 包 ADD VALUE / CREATE INDEX IF NOT EXISTS 实现幂等。

-- ── 1. NotificationType 追加 3 个企业相关枚举值 ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'ORG_INVITE'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'ORG_INVITE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'ORG_INVITE_RESPONSE'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'ORG_INVITE_RESPONSE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'ORG_MEMBER_REMOVED'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'ORG_MEMBER_REMOVED';
  END IF;
END $$;

-- ── 2. 创建 OrgInviteStatus enum（如果不存在）──────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrgInviteStatus') THEN
    CREATE TYPE "OrgInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED');
  END IF;
END $$;

-- ── 3. organizations：补字段（owner_id 需要回填，使用 first admin 兜底）─
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "owner_id"      TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "industry"      TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "size"          TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "contact_email" TEXT;

-- 回填 owner_id：先用任意 ADMIN 用户兜底（生产环境此 stub 表本就为空），后再加 NOT NULL + FK
DO $$
DECLARE
  fallback_admin TEXT;
BEGIN
  SELECT id INTO fallback_admin FROM "users" WHERE role = 'ADMIN' LIMIT 1;
  IF fallback_admin IS NOT NULL THEN
    UPDATE "organizations" SET "owner_id" = fallback_admin WHERE "owner_id" IS NULL;
  END IF;
END $$;

-- 仅在所有行 owner_id NOT NULL 时加非空约束，避免空表 / stub 场景失败
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "organizations" WHERE "owner_id" IS NULL) THEN
    ALTER TABLE "organizations" ALTER COLUMN "owner_id" SET NOT NULL;
  END IF;
END $$;

-- owner_id FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_owner_id_fkey'
  ) THEN
    ALTER TABLE "organizations"
      ADD CONSTRAINT "organizations_owner_id_fkey"
      FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "organizations_owner_id_idx" ON "organizations" ("owner_id");

-- ── 4. organization_invites 表 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS "organization_invites" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "inviter_id"      TEXT NOT NULL,
  "invitee_id"      TEXT NOT NULL,
  "role"            "OrgRole" NOT NULL DEFAULT 'MEMBER',
  "status"          "OrgInviteStatus" NOT NULL DEFAULT 'PENDING',
  "message"         TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responded_at"    TIMESTAMP(3),
  CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_invites_organization_id_fkey'
  ) THEN
    ALTER TABLE "organization_invites"
      ADD CONSTRAINT "organization_invites_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_invites_inviter_id_fkey'
  ) THEN
    ALTER TABLE "organization_invites"
      ADD CONSTRAINT "organization_invites_inviter_id_fkey"
      FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_invites_invitee_id_fkey'
  ) THEN
    ALTER TABLE "organization_invites"
      ADD CONSTRAINT "organization_invites_invitee_id_fkey"
      FOREIGN KEY ("invitee_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "organization_invites_organization_id_status_idx"
  ON "organization_invites" ("organization_id", "status");

CREATE INDEX IF NOT EXISTS "organization_invites_invitee_id_status_idx"
  ON "organization_invites" ("invitee_id", "status");

-- ── 5. 部分唯一索引：同一 org × 同一 invitee 最多一条 PENDING ────────
-- Prisma schema 不支持部分唯一，业务层 createInvite 也会先查再插，但加索引兜底并发。
CREATE UNIQUE INDEX IF NOT EXISTS "organization_invites_org_invitee_pending_unique"
  ON "organization_invites" ("organization_id", "invitee_id")
  WHERE "status" = 'PENDING';
