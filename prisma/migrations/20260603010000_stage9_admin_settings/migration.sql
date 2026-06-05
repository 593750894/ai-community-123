-- Stage 9: 管理员能力增强 + /settings 偏好

-- 1. users 上加 隐私 + JWT epoch 字段
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_profile_public" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "tokens_valid_after" TIMESTAMP(3);

-- 2. 通知偏好表
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id"         TEXT PRIMARY KEY,
  "user_id"    TEXT NOT NULL,
  "type"       "NotificationType" NOT NULL,
  "enabled"    BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_preferences_user_fk" FOREIGN KEY ("user_id")
    REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_user_type_unique"
  ON "notification_preferences" ("user_id", "type");

-- 3. posts 上加 pinned 排序索引（频道 feed 把 pinned 放在 createdAt 前）
CREATE INDEX IF NOT EXISTS "posts_channel_pinned_created_idx"
  ON "posts" ("channel_id", "pinned", "created_at");
