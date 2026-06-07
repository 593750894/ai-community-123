/**
 * Stage 12.3：消息附件类型推断 + 列表 / 通知预览文本。
 * 这是纯函数，不依赖数据库 / cookie；不写 "use server"，可同时给 server action /
 * API route / 客户端工具复用。
 */
import { categorizeAttachment } from "@/lib/uploads/config";
import type { MessageAttachmentInput } from "@/lib/messages/schemas";

/**
 * 把附件数组推断出消息 type。
 * - 单个 image 且无文本 → IMAGE
 * - 否则只要有附件 → FILE（视频 / 音频 / pdf / zip / 多附件都走 FILE 分支统一渲染）
 * - 无附件 → TEXT
 */
export function inferMessageType(
  attachments: MessageAttachmentInput[],
): "TEXT" | "IMAGE" | "FILE" {
  if (attachments.length === 0) return "TEXT";
  if (attachments.length === 1) {
    return categorizeAttachment(attachments[0].mimeType) === "image"
      ? "IMAGE"
      : "FILE";
  }
  return "FILE";
}

/** 给通知 / 列表预览用：把消息内容 + 附件折叠为一行人类可读的短文本。 */
export function buildMessagePreview(
  content: string,
  attachments: MessageAttachmentInput[],
): string {
  if (content && content.trim().length > 0) return content;
  if (attachments.length === 0) return "";
  const first = attachments[0];
  const cat = categorizeAttachment(first.mimeType);
  const label =
    cat === "image"
      ? "[图片]"
      : cat === "video"
        ? "[视频]"
        : cat === "audio"
          ? "[语音]"
          : "[文件]";
  return attachments.length > 1
    ? `${label} ${first.name} 等 ${attachments.length} 项`
    : `${label} ${first.name}`;
}
