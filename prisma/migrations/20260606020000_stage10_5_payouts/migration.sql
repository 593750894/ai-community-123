-- Stage 10.5：创作者结算面板 + 提现流程
--
-- 变更：
--   1. NotificationType 追加 PAYOUT_AVAILABLE / PAYOUT_PAID（DO 包 ADD VALUE，防重跑）
--   2. users 表追加 payout_method / payout_account / payout_name（卖家收款账号，无默认）
--   3. payouts 表追加 requested_at + paid_by_id + paid_method/account/name/note（提现申请 + admin 打款快照）
--   4. payouts 新增 (seller_id, requested_at) 联合索引便于「待处理提现」筛选
--
-- 全部使用 IF NOT EXISTS / DO $$ 包 ADD VALUE 实现幂等。

-- ── 1. NotificationType 追加 PAYOUT_AVAILABLE / PAYOUT_PAID ─────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'PAYOUT_AVAILABLE'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'PAYOUT_AVAILABLE';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'PAYOUT_PAID'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'PAYOUT_PAID';
  END IF;
END $$;

-- ── 2. users：卖家收款账号 ───────────────────────────────────────────
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payout_method"  TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payout_account" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payout_name"    TEXT;

-- ── 3. payouts：提现申请 + admin 打款快照 ──────────────────────────
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "requested_at" TIMESTAMP(3);
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "paid_by_id"   TEXT;
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "paid_method"  TEXT;
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "paid_account" TEXT;
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "paid_name"    TEXT;
ALTER TABLE "payouts" ADD COLUMN IF NOT EXISTS "paid_note"    TEXT;

-- ── 4. payouts：(seller_id, requested_at) 索引 ─────────────────────
CREATE INDEX IF NOT EXISTS "payouts_seller_id_requested_at_idx"
  ON "payouts" ("seller_id", "requested_at");
