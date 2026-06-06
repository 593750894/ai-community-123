-- Stage 10.4：退款 + Admin 订单管理
--
-- 变更：
--   1. NotificationType 新增 ORDER_REFUNDED
--   2. 新枚举 RefundStatus (PENDING / SUCCESS / FAILED)
--   3. 新表 refunds — 每笔订单的多次退款拆行；R{refunds.id} 即为 out_refund_no/out_request_no
--
-- 注意：refundCents / refundReason / refundedAt / refundedById 已在 Stage 10.1 加在 orders 表上，
-- 这里只做累计汇总写回；明细全部走 refunds 表。

-- ── 1. NotificationType 追加 ORDER_REFUNDED ─────────────────────────
-- enum ADD VALUE 不在事务内执行；用 DO + IF NOT IN EXISTS 防重跑。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'NotificationType' AND e.enumlabel = 'ORDER_REFUNDED'
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'ORDER_REFUNDED';
  END IF;
END $$;

-- ── 2. RefundStatus 枚举 ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RefundStatus') THEN
    CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
  END IF;
END $$;

-- ── 3. refunds 表 ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "refunds" (
  "id"                TEXT PRIMARY KEY,
  "order_id"          TEXT NOT NULL,
  "amount_cents"      INTEGER NOT NULL,
  "reason"            TEXT,
  "status"            "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "provider_response" JSONB,
  "provider_error"    TEXT,
  "created_by_id"     TEXT NOT NULL,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at"       TIMESTAMP(3),
  CONSTRAINT "refunds_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "refunds_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "refunds_order_id_created_at_idx"
  ON "refunds" ("order_id", "created_at");
CREATE INDEX IF NOT EXISTS "refunds_status_created_at_idx"
  ON "refunds" ("status", "created_at");
