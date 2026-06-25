-- Stage 18.0：上线前清单。
-- 仅扩展 BlockedWordScope 枚举（追加 USER + ORGANIZATION）。
-- 其它项（cron / 申诉上限 / /me 过滤）纯业务层，不动 schema。
-- 全幂等：可重复 apply。

DO $$
BEGIN
  ALTER TYPE "BlockedWordScope" ADD VALUE IF NOT EXISTS 'USER';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE "BlockedWordScope" ADD VALUE IF NOT EXISTS 'ORGANIZATION';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
