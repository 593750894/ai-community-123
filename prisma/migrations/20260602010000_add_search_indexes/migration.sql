-- Stage 3: global search — enable pg_trgm + GIN indexes for ILIKE search across
-- Post / Work / User / Channel / Tool. trigram indexes accelerate substring
-- (ILIKE '%q%') matches which suit short multilingual queries better than tsvector
-- on this dataset size.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Post
CREATE INDEX IF NOT EXISTS "posts_title_trgm_idx"
  ON "posts" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "posts_content_trgm_idx"
  ON "posts" USING GIN ("content" gin_trgm_ops);

-- Work
CREATE INDEX IF NOT EXISTS "works_title_trgm_idx"
  ON "works" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "works_description_trgm_idx"
  ON "works" USING GIN ("description" gin_trgm_ops);

-- User
CREATE INDEX IF NOT EXISTS "users_name_trgm_idx"
  ON "users" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_username_trgm_idx"
  ON "users" USING GIN ("username" gin_trgm_ops);

-- Channel
CREATE INDEX IF NOT EXISTS "channels_name_trgm_idx"
  ON "channels" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "channels_description_trgm_idx"
  ON "channels" USING GIN ("description" gin_trgm_ops);

-- Tool
CREATE INDEX IF NOT EXISTS "tools_name_trgm_idx"
  ON "tools" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "tools_description_trgm_idx"
  ON "tools" USING GIN ("description" gin_trgm_ops);
