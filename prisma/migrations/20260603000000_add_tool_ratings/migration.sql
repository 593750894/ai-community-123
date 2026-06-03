-- Stage 8: 工具评分

-- 1. 在 tools 上加聚合列
ALTER TABLE "tools"
  ADD COLUMN IF NOT EXISTS "avg_rating" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rating_count" INTEGER NOT NULL DEFAULT 0;

-- 2. tool_ratings 主表（一个 user 一条工具评分）
CREATE TABLE IF NOT EXISTS "tool_ratings" (
  "id"         TEXT PRIMARY KEY,
  "tool_id"    TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "stars"      INTEGER NOT NULL,
  "comment"    TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tool_ratings_tool_fk" FOREIGN KEY ("tool_id")
    REFERENCES "tools" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tool_ratings_user_fk" FOREIGN KEY ("user_id")
    REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "tool_ratings_tool_user_unique"
  ON "tool_ratings" ("tool_id", "user_id");

CREATE INDEX IF NOT EXISTS "tool_ratings_tool_created_idx"
  ON "tool_ratings" ("tool_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "tool_ratings_user_idx"
  ON "tool_ratings" ("user_id");
