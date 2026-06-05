-- Stage 10.1: 商业化基础 — Order 扩展 + Payout + NotificationType + MembershipPlan.trialDays

-- 1. NotificationType 追加两个枚举值
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ORDER_PAID';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WORKFLOW_SOLD';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. PayoutStatus 枚举
DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'AVAILABLE', 'PAID', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. membership_plans 加 trial_days + 复合索引
ALTER TABLE "membership_plans"
  ADD COLUMN IF NOT EXISTS "trial_days" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "membership_plans_active_sort_idx"
  ON "membership_plans" ("is_active", "sort_order");

-- 4. orders 扩展：支付凭据 + 退款 + 过期时间
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "transaction_id"   TEXT,
  ADD COLUMN IF NOT EXISTS "callback_payload" JSONB,
  ADD COLUMN IF NOT EXISTS "expires_at"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refund_cents"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refund_reason"    TEXT,
  ADD COLUMN IF NOT EXISTS "refunded_by_id"   TEXT;

CREATE INDEX IF NOT EXISTS "orders_status_expires_idx"
  ON "orders" ("status", "expires_at");

-- 5. payouts 表
CREATE TABLE IF NOT EXISTS "payouts" (
  "id"                 TEXT PRIMARY KEY,
  "order_id"           TEXT NOT NULL UNIQUE,
  "seller_id"          TEXT NOT NULL,
  "gross_cents"        INTEGER NOT NULL,
  "platform_fee_cents" INTEGER NOT NULL,
  "net_cents"          INTEGER NOT NULL,
  "currency"           TEXT NOT NULL DEFAULT 'CNY',
  "status"             "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "available_at"       TIMESTAMP(3) NOT NULL,
  "paid_at"            TIMESTAMP(3),
  "metadata"           JSONB,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payouts_order_fk" FOREIGN KEY ("order_id")
    REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payouts_seller_fk" FOREIGN KEY ("seller_id")
    REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "payouts_seller_status_idx"
  ON "payouts" ("seller_id", "status");
CREATE INDEX IF NOT EXISTS "payouts_status_available_idx"
  ON "payouts" ("status", "available_at");
