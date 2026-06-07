-- Stage 11.2：企业认证审核流程
--
-- 变更：
--   1. NotificationType 追加 ORG_VERIFICATION_APPROVED / ORG_VERIFICATION_REJECTED
--   2. 新 enum OrgVerificationStatus (NONE/PENDING/APPROVED/REJECTED)
--   3. organizations 表追加 11 个认证字段（status + 资料快照 + 审核备注 + 时间戳 + reviewedBy FK）
--   4. organizations 加 (verification_status, verification_submitted_at) 复合索引，便于 admin 列表「待审优先」
--
-- 全部使用 IF NOT EXISTS / DO $$ 包 ADD VALUE / CREATE TYPE 防重跑。

-- ── 1. NotificationType 追加 2 个认证相关枚举值 ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'ORG_VERIFICATION_APPROVED'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'ORG_VERIFICATION_APPROVED';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'ORG_VERIFICATION_REJECTED'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'ORG_VERIFICATION_REJECTED';
  END IF;
END $$;

-- ── 2. OrgVerificationStatus enum ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrgVerificationStatus') THEN
    CREATE TYPE "OrgVerificationStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $$;

-- ── 3. organizations：补 11 个字段 ───────────────────────────────
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "verification_status" "OrgVerificationStatus" NOT NULL DEFAULT 'NONE';

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "verification_name"          TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "verification_reg_no"        TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "verification_rep"           TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "verification_license_url"   TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "verification_contact"       TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "verification_note"          TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "verification_review_note"   TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "verification_submitted_at"  TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "verification_reviewed_at"   TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "verification_reviewed_by"   TEXT;

-- 已有 is_verified=true 的企业（手工 backfill 场景）→ 状态置为 APPROVED 以保持一致
UPDATE "organizations" SET "verification_status" = 'APPROVED'
WHERE "is_verified" = true AND "verification_status" = 'NONE';

-- ── 4. reviewedBy FK ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_verification_reviewed_by_fkey'
  ) THEN
    ALTER TABLE "organizations"
      ADD CONSTRAINT "organizations_verification_reviewed_by_fkey"
      FOREIGN KEY ("verification_reviewed_by") REFERENCES "users"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

-- ── 5. (verification_status, verification_submitted_at) 索引 ────
CREATE INDEX IF NOT EXISTS "organizations_verification_status_submitted_at_idx"
  ON "organizations" ("verification_status", "verification_submitted_at");
