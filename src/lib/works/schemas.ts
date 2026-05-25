import { z } from "zod";

import { WORK_CATEGORY_VALUES } from "@/lib/work-categories";

const requiredUrl = z
  .string()
  .trim()
  .min(1, "请输入链接")
  .max(500, "URL 不能超过 500 字符")
  .url("请输入有效的 URL");

const optionalUrl = z
  .string()
  .trim()
  .max(500, "URL 不能超过 500 字符")
  .url("请输入有效的 URL")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

export const CreateWorkSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "标题至少 2 个字符")
    .max(120, "标题最多 120 个字符"),
  description: z
    .string()
    .trim()
    .max(2000, "简介最多 2000 个字符")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
  thumbnailUrl: optionalUrl,
  videoUrl: requiredUrl,
  category: z.enum(WORK_CATEGORY_VALUES),
  // tools 以英文逗号分隔的字符串输入，解析为去重后的非空数组
  tools: z
    .string()
    .trim()
    .max(500, "使用工具最多 500 字符")
    .optional()
    .or(z.literal(""))
    .transform((v) => {
      if (!v) return [] as string[];
      const seen = new Set<string>();
      for (const part of v.split(/[,，]/)) {
        const t = part.trim();
        if (t) seen.add(t);
      }
      return Array.from(seen).slice(0, 10);
    }),
});

export type CreateWorkInput = z.infer<typeof CreateWorkSchema>;

export const UpdateWorkSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "标题至少 2 个字符")
    .max(120, "标题最多 120 个字符")
    .optional(),
  description: z
    .string()
    .trim()
    .max(2000, "简介最多 2000 个字符")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null)),
  thumbnailUrl: optionalUrl,
  videoUrl: requiredUrl.optional(),
  category: z.enum(WORK_CATEGORY_VALUES).optional(),
  tools: z
    .string()
    .trim()
    .max(500, "使用工具最多 500 字符")
    .optional()
    .or(z.literal(""))
    .transform((v) => {
      if (!v) return undefined;
      const seen = new Set<string>();
      for (const part of v.split(/[,，]/)) {
        const t = part.trim();
        if (t) seen.add(t);
      }
      return Array.from(seen).slice(0, 10);
    }),
});

export type UpdateWorkInput = z.infer<typeof UpdateWorkSchema>;
