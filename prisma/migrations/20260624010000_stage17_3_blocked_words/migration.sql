-- Stage 17.3：发布期关键词黑名单。
-- 1) 新 enum BlockedWordSeverity (WARN/BLOCK) + BlockedWordScope (ALL/POST/WORK/COMMENT/COLLABORATION/MESSAGE/WORKFLOW_ITEM)
-- 2) 新 blocked_words 表 + 唯一 pattern + scope/severity 索引 + FK→users(restrict)
-- 全幂等：可重复 apply。

-- ───────────────────────────────── enums ─────────────────────────────────

DO $$
BEGIN
  CREATE TYPE "BlockedWordSeverity" AS ENUM ('WARN', 'BLOCK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "BlockedWordScope" AS ENUM (
    'ALL', 'POST', 'WORK', 'COMMENT', 'COLLABORATION', 'MESSAGE', 'WORKFLOW_ITEM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────── blocked_words ───────────────────────────────

CREATE TABLE IF NOT EXISTS "blocked_words" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "pattern"       TEXT NOT NULL,
  "severity"      "BlockedWordSeverity" NOT NULL DEFAULT 'BLOCK',
  "scope"         "BlockedWordScope" NOT NULL DEFAULT 'ALL',
  "note"          TEXT,
  "hit_count"     INTEGER NOT NULL DEFAULT 0,
  "created_by_id" TEXT NOT NULL,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "blocked_words_pattern_key"
  ON "blocked_words"("pattern");

CREATE INDEX IF NOT EXISTS "blocked_words_scope_idx"
  ON "blocked_words"("scope");

CREATE INDEX IF NOT EXISTS "blocked_words_severity_idx"
  ON "blocked_words"("severity");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blocked_words_created_by_id_fkey'
  ) THEN
    ALTER TABLE "blocked_words"
      ADD CONSTRAINT "blocked_words_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
