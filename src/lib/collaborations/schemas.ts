import { z } from "zod";

import {
  COLLAB_CATEGORY_VALUES,
  COLLAB_LOCATION_VALUES,
  COLLAB_STATUS_VALUES,
  COLLAB_TYPE_VALUES,
  COLLAB_WORK_MODE_VALUES,
} from "@/lib/collaborations/categories";

const optionalShort = z
  .string()
  .trim()
  .max(80, "最多 80 个字符")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

export const CreateCollaborationSchema = z.object({
  category: z.enum(COLLAB_CATEGORY_VALUES),
  type: z.enum(COLLAB_TYPE_VALUES).optional().default("LOOKING_FOR"),
  workMode: z.enum(COLLAB_WORK_MODE_VALUES),
  location: z.enum(COLLAB_LOCATION_VALUES),
  title: z
    .string()
    .trim()
    .min(4, "标题至少 4 个字符")
    .max(80, "标题最多 80 个字符"),
  description: z
    .string()
    .trim()
    .min(20, "需求描述至少 20 个字符，说清楚交付物 / 期望")
    .max(3000, "需求描述最多 3000 字符"),
  budget: optionalShort,
  contact: z
    .string()
    .trim()
    .min(2, "请填写联系方式（微信 / 邮箱 / 手机均可）")
    .max(120, "联系方式最多 120 字符"),
  // tags 由 client 端以英文逗号分隔字符串提交
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

export type CreateCollaborationInput = z.infer<typeof CreateCollaborationSchema>;

export const UpdateCollabStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(COLLAB_STATUS_VALUES),
});
