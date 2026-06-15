-- Stage 17.1：MOD 队列认领。
-- 引入 Report.assigned_to_id / assigned_at + FK + 复合索引（"my queue" 查询）。
-- 全幂等：可重复 apply。

ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "assigned_to_id" TEXT;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "assigned_at"    TIMESTAMP(3);

-- 外键：认领者删号后 assignment 置空，举报本身不动（status 仍是 REVIEWING，由其它 MOD 重新接手）。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_assigned_to_id_fkey'
  ) THEN
    ALTER TABLE "reports"
      ADD CONSTRAINT "reports_assigned_to_id_fkey"
      FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- "我处理的" 队列：WHERE assigned_to_id = $1 AND status = 'REVIEWING'。
CREATE INDEX IF NOT EXISTS "reports_assigned_to_id_status_idx"
  ON "reports"("assigned_to_id", "status");
