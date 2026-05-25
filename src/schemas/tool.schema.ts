import { z } from "zod";

const TOOL_PRICING_VALUES = ["FREE", "FREEMIUM", "PAID"] as const;

export const CreateToolSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请输入工具名称")
    .max(60, "名称最多 60 个字符"),
  description: z
    .string()
    .trim()
    .min(10, "描述至少 10 个字符")
    .max(500, "描述最多 500 个字符"),
  url: z
    .string()
    .trim()
    .url("请输入有效的 URL")
    .max(500, "URL 最多 500 字符"),
  category: z
    .string()
    .trim()
    .min(1, "请选择分类")
    .max(40, "分类最多 40 个字符"),
  useCase: z
    .string()
    .trim()
    .max(200, "使用场景最多 200 个字符")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
  logoUrl: z
    .string()
    .trim()
    .url("请输入有效的 Logo URL")
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
  pricing: z.enum(TOOL_PRICING_VALUES).default("FREE"),
  tags: z
    .string()
    .trim()
    .max(200, "标签最多 200 个字符")
    .optional()
    .or(z.literal(""))
    .transform((v) => {
      if (!v) return [] as string[];
      const seen = new Set<string>();
      for (const part of v.split(/[,，]/)) {
        const t = part.trim();
        if (t) seen.add(t);
      }
      return Array.from(seen).slice(0, 8);
    }),
});

export type CreateToolInput = z.infer<typeof CreateToolSchema>;

export const UpdateToolSchema = CreateToolSchema.partial();

export type UpdateToolInput = z.infer<typeof UpdateToolSchema>;
