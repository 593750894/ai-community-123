import {
  Box,
  Captions,
  FileText,
  Image as ImageIcon,
  ImagePlus,
  Film,
  Mic,
  Music,
  Scissors,
  UserSquare,
  Wrench,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import type { PillTagTint } from "@/components/ui/pill-tag";

// 工具库 (Tool) 的 11 个标准分类。
// Prisma 里 `Tool.category` 仍是 String，这里手写枚举值是为了：
//   1. 服务端 / 客户端共用，不拖入 prisma runtime
//   2. 校验 URL query 里的 ?category= 参数是否合法
//   3. 集中维护中文标签 + 颜色 + 简介
// 新增类别时记得：
//   - 同步 web/prisma/seed.ts 里的工具记录
//   - 检查 /tools 页面 chip 排版是否会换行

export const TOOL_CATEGORY_VALUES = [
  "TEXT_TO_VIDEO",
  "IMAGE_TO_VIDEO",
  "VIDEO_TO_VIDEO",
  "DIGITAL_HUMAN",
  "VOICE",
  "SUBTITLE",
  "EDIT",
  "WORKFLOW",
  "IMAGE_GEN",
  "THREE_D",
  "MUSIC",
] as const;

export type ToolCategoryValue = (typeof TOOL_CATEGORY_VALUES)[number];

export type ToolCategoryMeta = {
  value: ToolCategoryValue;
  label: string;
  desc: string;
  icon: LucideIcon;
  /** V2 PillTag tint (DESIGN.md §7 7-tint vocabulary). */
  tint: PillTagTint;
};

export const TOOL_CATEGORY_META: Record<ToolCategoryValue, ToolCategoryMeta> = {
  TEXT_TO_VIDEO: {
    value: "TEXT_TO_VIDEO",
    label: "文生视频",
    desc: "纯文字描述生成视频",
    icon: FileText,
    tint: "cyan",
  },
  IMAGE_TO_VIDEO: {
    value: "IMAGE_TO_VIDEO",
    label: "图生视频",
    desc: "参考图驱动的视频生成",
    icon: ImageIcon,
    tint: "blue",
  },
  VIDEO_TO_VIDEO: {
    value: "VIDEO_TO_VIDEO",
    label: "视频转视频",
    desc: "风格迁移 / 重绘 / 增强",
    icon: Film,
    tint: "blue",
  },
  DIGITAL_HUMAN: {
    value: "DIGITAL_HUMAN",
    label: "数字人",
    desc: "形象生成 + 口型 + 表情驱动",
    icon: UserSquare,
    tint: "emerald",
  },
  VOICE: {
    value: "VOICE",
    label: "配音",
    desc: "TTS · 声音克隆 · 多语言",
    icon: Mic,
    tint: "violet",
  },
  SUBTITLE: {
    value: "SUBTITLE",
    label: "字幕",
    desc: "自动识别 / 翻译 / 时间轴",
    icon: Captions,
    tint: "emerald",
  },
  EDIT: {
    value: "EDIT",
    label: "剪辑",
    desc: "时间线 · 调色 · 转场",
    icon: Scissors,
    tint: "rose",
  },
  WORKFLOW: {
    value: "WORKFLOW",
    label: "工作流",
    desc: "ComfyUI · 节点图 · 流水线",
    icon: Workflow,
    tint: "cyan",
  },
  IMAGE_GEN: {
    value: "IMAGE_GEN",
    label: "图像生成",
    desc: "首尾帧 · 概念图 · 风格图",
    icon: ImagePlus,
    tint: "violet",
  },
  THREE_D: {
    value: "THREE_D",
    label: "3D 生成",
    desc: "图片/文本 → 3D 模型",
    icon: Box,
    tint: "violet",
  },
  MUSIC: {
    value: "MUSIC",
    label: "音乐音效",
    desc: "AI 编曲 / 配乐 / SFX",
    icon: Music,
    tint: "amber",
  },
};

export const TOOL_CATEGORY_ORDER: ToolCategoryValue[] = [...TOOL_CATEGORY_VALUES];

export function toolCategoryMeta(category: string): ToolCategoryMeta {
  return (
    TOOL_CATEGORY_META[category as ToolCategoryValue] ??
    // 未知 / 历史值兜底（旧 seed 里有"视频生成"等中文，需要展示也不要崩）
    {
      value: (category as ToolCategoryValue) ?? "WORKFLOW",
      label: category || "未分类",
      desc: "",
      icon: Wrench,
      tint: "slate",
    }
  );
}

export function isToolCategoryValue(v: unknown): v is ToolCategoryValue {
  return typeof v === "string" && (TOOL_CATEGORY_VALUES as readonly string[]).includes(v);
}

// ───────── 计费 ─────────

export const TOOL_PRICING_VALUES = ["FREE", "FREEMIUM", "PAID"] as const;
export type ToolPricingValue = (typeof TOOL_PRICING_VALUES)[number];

export const TOOL_PRICING_LABEL: Record<ToolPricingValue, string> = {
  FREE: "免费",
  FREEMIUM: "免费 + 付费",
  PAID: "付费",
};

export const TOOL_PRICING_TINT: Record<ToolPricingValue, PillTagTint> = {
  FREE: "emerald",
  FREEMIUM: "amber",
  PAID: "rose",
};
