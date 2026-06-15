-- Stage 16.4：分润后退款的追讨表（ClawbackRequest）
--
-- 触发链：refundOrder SUCCESS → 关联 Payout 已 PAID → 卖家已收钱 → 平台垫资。
-- 建一行 PENDING ClawbackRequest 记录欠款，ops 决定追回方式（扣减下次结算 / 线下追 / 豁免）。
--
-- 表只记录欠款流水，不自动从下次 payout.netCents 扣除：
-- ops 自行决策抵扣到哪笔，落 status=DEDUCTED + note。

CREATE TYPE "ClawbackStatus" AS ENUM ('PENDING', 'DEDUCTED', 'MANUAL', 'WAIVED');

CREATE TABLE "clawback_requests" (
  "id"             TEXT             PRIMARY KEY,
  "refund_id"      TEXT             NOT NULL UNIQUE,
  "payout_id"      TEXT             NOT NULL,
  "seller_id"      TEXT             NOT NULL,
  "order_id"       TEXT             NOT NULL,
  "order_no"       TEXT             NOT NULL,
  "amount_cents"   INTEGER          NOT NULL,
  "currency"       TEXT             NOT NULL DEFAULT 'CNY',
  "status"         "ClawbackStatus" NOT NULL DEFAULT 'PENDING',
  "note"           TEXT,
  "created_at"     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at"    TIMESTAMP,
  "resolved_by_id" TEXT,

  CONSTRAINT "clawback_requests_refund_id_fkey"
    FOREIGN KEY ("refund_id")  REFERENCES "refunds"("id")  ON DELETE CASCADE,
  CONSTRAINT "clawback_requests_payout_id_fkey"
    FOREIGN KEY ("payout_id")  REFERENCES "payouts"("id")  ON DELETE RESTRICT,
  CONSTRAINT "clawback_requests_order_id_fkey"
    FOREIGN KEY ("order_id")   REFERENCES "orders"("id")   ON DELETE CASCADE,
  CONSTRAINT "clawback_requests_seller_id_fkey"
    FOREIGN KEY ("seller_id")  REFERENCES "users"("id")    ON DELETE CASCADE,
  CONSTRAINT "clawback_requests_resolved_by_id_fkey"
    FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "clawback_requests_seller_id_status_idx"
  ON "clawback_requests" ("seller_id", "status");

CREATE INDEX "clawback_requests_status_created_at_idx"
  ON "clawback_requests" ("status", "created_at");
