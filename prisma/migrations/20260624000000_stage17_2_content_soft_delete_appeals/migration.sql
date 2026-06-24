-- Stage 17.2：内容软删除 + 申诉系统。
-- 1) Post / Work / Comment / Collaboration 各加 deleted_at / deleted_by_id / deletion_reason + FK + index。
-- 2) NotificationType 加 CONTENT_REMOVED / APPEAL_APPROVED / APPEAL_REJECTED。
-- 3) 新 enum ContentAppealTargetType / ContentAppealStatus + content_appeals 表。
-- 4) content_appeals 部分唯一索引：同一目标在任一时点只允许一条 PENDING。
-- 全幂等：可重复 apply。

-- ───────────────────────────────── enums ─────────────────────────────────

DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTENT_REMOVED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPEAL_APPROVED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPEAL_REJECTED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ContentAppealTargetType" AS ENUM ('POST', 'WORK', 'COMMENT', 'COLLABORATION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ContentAppealStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────── soft-delete columns ───────────────────────────────

-- posts
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "deleted_at"       TIMESTAMP(3);
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "deleted_by_id"    TEXT;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "deletion_reason"  TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_deleted_by_id_fkey'
  ) THEN
    ALTER TABLE "posts"
      ADD CONSTRAINT "posts_deleted_by_id_fkey"
      FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "posts_deleted_at_idx" ON "posts"("deleted_at");

-- works
ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "deleted_at"       TIMESTAMP(3);
ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "deleted_by_id"    TEXT;
ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "deletion_reason"  TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'works_deleted_by_id_fkey'
  ) THEN
    ALTER TABLE "works"
      ADD CONSTRAINT "works_deleted_by_id_fkey"
      FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "works_deleted_at_idx" ON "works"("deleted_at");

-- comments
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "deleted_at"       TIMESTAMP(3);
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "deleted_by_id"    TEXT;
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "deletion_reason"  TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comments_deleted_by_id_fkey'
  ) THEN
    ALTER TABLE "comments"
      ADD CONSTRAINT "comments_deleted_by_id_fkey"
      FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "comments_deleted_at_idx" ON "comments"("deleted_at");

-- collaborations
ALTER TABLE "collaborations" ADD COLUMN IF NOT EXISTS "deleted_at"       TIMESTAMP(3);
ALTER TABLE "collaborations" ADD COLUMN IF NOT EXISTS "deleted_by_id"    TEXT;
ALTER TABLE "collaborations" ADD COLUMN IF NOT EXISTS "deletion_reason"  TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'collaborations_deleted_by_id_fkey'
  ) THEN
    ALTER TABLE "collaborations"
      ADD CONSTRAINT "collaborations_deleted_by_id_fkey"
      FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "collaborations_deleted_at_idx" ON "collaborations"("deleted_at");

-- ─────────────────────────────── content_appeals ───────────────────────────────

CREATE TABLE IF NOT EXISTS "content_appeals" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "appellant_id"   TEXT NOT NULL,
  "target_type"    "ContentAppealTargetType" NOT NULL,
  "target_id"      TEXT NOT NULL,
  "reason"         TEXT NOT NULL,
  "status"         "ContentAppealStatus" NOT NULL DEFAULT 'PENDING',
  "review_note"    TEXT,
  "reviewed_by_id" TEXT,
  "reviewed_at"    TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_appeals_appellant_id_fkey'
  ) THEN
    ALTER TABLE "content_appeals"
      ADD CONSTRAINT "content_appeals_appellant_id_fkey"
      FOREIGN KEY ("appellant_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_appeals_reviewed_by_id_fkey'
  ) THEN
    ALTER TABLE "content_appeals"
      ADD CONSTRAINT "content_appeals_reviewed_by_id_fkey"
      FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "content_appeals_appellant_id_created_at_idx"
  ON "content_appeals"("appellant_id", "created_at");

CREATE INDEX IF NOT EXISTS "content_appeals_status_created_at_idx"
  ON "content_appeals"("status", "created_at");

CREATE INDEX IF NOT EXISTS "content_appeals_target_type_target_id_idx"
  ON "content_appeals"("target_type", "target_id");

-- 部分唯一：每个目标在任一时点最多一条 PENDING 申诉。
-- 历史 REJECTED 不阻塞新申诉（用户可在新证据出现后再次发起）。
CREATE UNIQUE INDEX IF NOT EXISTS "content_appeals_target_pending_unique"
  ON "content_appeals"("target_type", "target_id")
  WHERE "status" = 'PENDING';
