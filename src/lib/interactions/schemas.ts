import { z } from "zod";

const LikeTargetType = z.enum(["POST", "WORK", "COMMENT"]);
const BookmarkTargetType = z.enum(["POST", "WORK"]);

export const ToggleLikeSchema = z.object({
  targetType: LikeTargetType,
  targetId: z.string().min(1, "targetId 缺失"),
});

export type ToggleLikeInput = z.infer<typeof ToggleLikeSchema>;

export const ToggleBookmarkSchema = z.object({
  targetType: BookmarkTargetType,
  targetId: z.string().min(1, "targetId 缺失"),
});

export type ToggleBookmarkInput = z.infer<typeof ToggleBookmarkSchema>;

export const InteractionStatusSchema = z.object({
  targetType: BookmarkTargetType,
  targetId: z.string().min(1, "targetId 缺失"),
});

export type InteractionStatusInput = z.infer<typeof InteractionStatusSchema>;
