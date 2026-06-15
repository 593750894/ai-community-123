-- Stage 17.5：禁言原因 / 期限 / 操作 admin 快照。
-- SUSPENDED 用户保留登录态（read-only），suspendedUntil 到期由 cron 自动解禁。
-- BANNED / DELETED 仍是终态。

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspension_reason" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_until"   TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_at"      TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_by_id"   TEXT;

-- 外键：操作 admin 删号 / 注销时不要级联删 suspended user。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_suspended_by_id_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_suspended_by_id_fkey"
      FOREIGN KEY ("suspended_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- cron / admin 列表 WHERE status='SUSPENDED' AND suspended_until <= now() 加复合索引。
CREATE INDEX IF NOT EXISTS "users_status_suspended_until_idx"
  ON "users"("status", "suspended_until");
