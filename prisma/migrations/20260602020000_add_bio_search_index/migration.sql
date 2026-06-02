-- Stage 3 follow-up: search/index.ts also queries User.bio with ILIKE,
-- but the prior migration only indexed name + username. Add the missing
-- trigram index so bio search uses the GIN index instead of seq scan.

CREATE INDEX IF NOT EXISTS "users_bio_trgm_idx"
  ON "users" USING GIN ("bio" gin_trgm_ops);
