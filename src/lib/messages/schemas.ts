import { z } from "zod";

export const StartConversationSchema = z.object({
  targetUserId: z.string().min(1, "targetUserId 缺失"),
});

export const SendMessageSchema = z.object({
  conversationId: z.string().min(1, "conversationId 缺失"),
  content: z
    .string()
    .trim()
    .min(1, "消息不能为空")
    .max(4000, "消息最多 4000 个字符"),
});

export type StartConversationInput = z.infer<typeof StartConversationSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
