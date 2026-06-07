-- Stage 11.3：企业内容归属
--
-- 变更：
--   1. posts / works / collaborations / workflow_items 四张表各加 organization_id (nullable)
--   2. 各加一条到 organizations(id) 的 FK，ON DELETE SET NULL（保留内容历史，仅卸下归属）
--   3. 各加一条 (organization_id, created_at) 索引，便于「企业 feed」按时间聚合
--
-- 全部使用 IF NOT EXISTS / DO $$ 包 ADD CONSTRAINT，可重跑。

-- ── 1. posts.organization_id ──────────────────────────────────────
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_organization_id_fkey'
  ) THEN
    ALTER TABLE "posts"
      ADD CONSTRAINT "posts_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "posts_organization_id_created_at_idx"
  ON "posts" ("organization_id", "created_at");

-- ── 2. works.organization_id ──────────────────────────────────────
ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'works_organization_id_fkey'
  ) THEN
    ALTER TABLE "works"
      ADD CONSTRAINT "works_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "works_organization_id_created_at_idx"
  ON "works" ("organization_id", "created_at");

-- ── 3. collaborations.organization_id ─────────────────────────────
ALTER TABLE "collaborations" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'collaborations_organization_id_fkey'
  ) THEN
    ALTER TABLE "collaborations"
      ADD CONSTRAINT "collaborations_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "collaborations_organization_id_created_at_idx"
  ON "collaborations" ("organization_id", "created_at");

-- ── 4. workflow_items.organization_id ─────────────────────────────
ALTER TABLE "workflow_items" ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workflow_items_organization_id_fkey'
  ) THEN
    ALTER TABLE "workflow_items"
      ADD CONSTRAINT "workflow_items_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "workflow_items_organization_id_created_at_idx"
  ON "workflow_items" ("organization_id", "created_at");
