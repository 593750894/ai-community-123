-- Stage 1 follow-up: the dedup findFirst in notifications/emit.ts filters
-- by (userId, actorId, type, targetType, targetId, createdAt). Without a
-- matching composite index, this scans userId-prefixed rows every emit.
-- This index lets the dedup probe become an index lookup.

CREATE INDEX IF NOT EXISTS "notifications_dedup_idx"
  ON "notifications" (user_id, actor_id, type, target_type, target_id, created_at DESC);
