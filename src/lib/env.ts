import { z } from "zod";

/**
 * 集中化运行期环境校验。模块被任何 import 时立即 fail-fast，
 * 避免错配的 .env 在请求处理时才暴露成 500。
 *
 * 关键不变量：
 * - AUTH_SECRET 是 base64 编码，解码后恰好 32 字节（HS256 推荐密钥长度）。
 * - DATABASE_URL 必须是 postgres(ql)://...
 * - CRON_SECRET 设置后 ≥32 字符；未配置则 cron 路由始终 403（约定为「cron 关闭」）。
 * - PAYMENT_MOCK_ENABLED 仅 'true' 视为启用；启用时必须同时配 PAYMENT_MOCK_SECRET ≥16 字符。
 *   不再有「非 production 自动启用 + 默认密钥回退」的隐式行为。
 *
 * 生成 AUTH_SECRET：
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

const boolish = z
  .union([z.literal("true"), z.literal("false"), z.undefined()])
  .transform((v) => v === "true");

const rawSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .refine(
        (v) =>
          v.startsWith("postgres://") || v.startsWith("postgresql://"),
        "DATABASE_URL must be a postgres connection string",
      ),
    AUTH_SECRET: z
      .string()
      .min(1, "AUTH_SECRET is required (base64-encoded 32 bytes)")
      .refine((v) => {
        try {
          return Buffer.from(v, "base64").length === 32;
        } catch {
          return false;
        }
      }, "AUTH_SECRET must decode to exactly 32 bytes. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""),
    CRON_SECRET: z
      .string()
      .min(32, "CRON_SECRET must be at least 32 characters when set")
      .optional(),
    PAYMENT_MOCK_ENABLED: boolish,
    PAYMENT_MOCK_SECRET: z
      .string()
      .min(16, "PAYMENT_MOCK_SECRET must be at least 16 characters when set")
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.PAYMENT_MOCK_ENABLED && !v.PAYMENT_MOCK_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["PAYMENT_MOCK_SECRET"],
        message:
          "PAYMENT_MOCK_SECRET is required when PAYMENT_MOCK_ENABLED=true. Generate with: node -e \"console.log(require('crypto').randomBytes(24).toString('hex'))\"",
      });
    }
  });

function parseEnv() {
  const parsed = rawSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    PAYMENT_MOCK_ENABLED: process.env.PAYMENT_MOCK_ENABLED,
    PAYMENT_MOCK_SECRET: process.env.PAYMENT_MOCK_SECRET,
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const lines = Object.entries(fieldErrors)
      .map(([k, v]) => `  ${k}: ${(v ?? []).join("; ")}`)
      .join("\n");
    throw new Error(
      `[env] startup validation failed:\n${lines}\n\nSee .env.example for setup notes.`,
    );
  }
  return parsed.data;
}

const parsed = parseEnv();

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  IS_PRODUCTION: parsed.NODE_ENV === "production",
  DATABASE_URL: parsed.DATABASE_URL,
  /** Decoded 32-byte HMAC key for HS256 JWT signing. */
  AUTH_SECRET_KEY: Buffer.from(parsed.AUTH_SECRET, "base64"),
  CRON_SECRET: parsed.CRON_SECRET,
  PAYMENT_MOCK_ENABLED: parsed.PAYMENT_MOCK_ENABLED,
  PAYMENT_MOCK_SECRET: parsed.PAYMENT_MOCK_SECRET,
} as const;
