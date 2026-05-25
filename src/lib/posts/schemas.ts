import { z } from "zod";

import { POST_TYPE_VALUES } from "@/lib/post-types";

const optionalUrl = z
  .string()
  .trim()
  .max(500, "URL 不能超过 500 字符")
  .url("请输入有效的 URL")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

export const CreatePostSchema = z.object({
  channelId: z.string().min(1, "请选择频道"),
  type: z.enum(POST_TYPE_VALUES),
  title: z
    .string()
    .trim()
    .min(2, "标题至少 2 个字符")
    .max(120, "标题最多 120 个字符"),
  content: z
    .string()
    .trim()
    .min(1, "请输入正文")
    .max(8000, "正文最多 8000 个字符"),
  videoUrl: optionalUrl,
  imageUrl: optionalUrl,
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export const UpdatePostSchema = z.object({
  type: z.enum(POST_TYPE_VALUES).optional(),
  title: z
    .string()
    .trim()
    .min(2, "标题至少 2 个字符")
    .max(120, "标题最多 120 个字符")
    .optional(),
  content: z
    .string()
    .trim()
    .min(1, "请输入正文")
    .max(8000, "正文最多 8000 个字符")
    .optional(),
  videoUrl: optionalUrl,
  imageUrl: optionalUrl,
});

export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;
