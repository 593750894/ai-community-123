import { AppError } from "@/lib/errors";

/**
 * 极简的内存令牌桶，足够 MVP 单实例；多实例部署或需要持久化时换 Redis。
 *
 * 用法：
 *   const limiter = createRateLimiter({ limit: 20, windowMs: 60_000, name: "upload" });
 *   limiter.check(userId); // 超额抛 RATE_LIMITED (HTTP 429)
 */
export interface RateLimiter {
  /** 不超过限额时记录一次请求；超额抛 AppError(429)。 */
  check: (key: string) => void;
}

export function createRateLimiter(opts: {
  /** 每窗口最大请求数 */
  limit: number;
  /** 窗口长度（毫秒） */
  windowMs: number;
  /** 用于错误信息和日志的可读名 */
  name: string;
  /** 自定义错误信息生成（可选）。默认中文。 */
  message?: (opts: { limit: number; windowMs: number }) => string;
}): RateLimiter {
  const buckets = new Map<string, number[]>();
  let counter = 0;
  const prune = (now: number) => {
    for (const [key, ts] of buckets) {
      const alive = ts.filter((t) => now - t < opts.windowMs);
      if (alive.length === 0) buckets.delete(key);
      else if (alive.length !== ts.length) buckets.set(key, alive);
    }
  };
  const fallbackMsg = () =>
    `${opts.name} 操作过于频繁，请稍后再试（每 ${Math.round(
      opts.windowMs / 1000,
    )} 秒最多 ${opts.limit} 次）`;
  return {
    check(key: string) {
      const now = Date.now();
      if (++counter % 100 === 0) prune(now);
      const arr = buckets.get(key) ?? [];
      const fresh = arr.filter((t) => now - t < opts.windowMs);
      if (fresh.length >= opts.limit) {
        throw new AppError(
          opts.message?.({ limit: opts.limit, windowMs: opts.windowMs }) ??
            fallbackMsg(),
          "RATE_LIMITED",
          429,
        );
      }
      fresh.push(now);
      buckets.set(key, fresh);
    },
  };
}
