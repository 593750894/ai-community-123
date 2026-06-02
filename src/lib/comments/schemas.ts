import { z } from "zod";

export const CreateCommentSchema = z.object({
  postId: z.string().min(1, "postId 缺失"),
  content: z
    .string()
    .trim()
    .min(1, "评论不能为空")
    .max(2000, "评论最多 2000 个字符"),
  parentId: z.string().min(1).optional(),
});

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export const CreateCommentBodySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "评论不能为空")
    .max(2000, "评论最多 2000 个字符"),
  parentId: z.string().min(1).optional(),
});

export type CreateCommentBody = z.infer<typeof CreateCommentBodySchema>;
