-- Stage 10.2: payment safety — 防止并发 PAID 回调创建重复 ACTIVE 订阅

-- Postgres 部分唯一索引：仅对 status='ACTIVE' 强制 (user_id, plan_id) 唯一。
-- 同一用户对同一计划只能有一条 ACTIVE 订阅；CANCELED/EXPIRED 历史记录不受影响。
-- markOrderPaid 在事务里 findFirst + create，并发场景下会撞这个唯一索引（P2002），
-- 业务层 catch P2002 后回退到 update 现有订阅（延期），保证最终一致。
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_user_plan_active_unique"
  ON "subscriptions" ("user_id", "plan_id")
  WHERE "status" = 'ACTIVE';
