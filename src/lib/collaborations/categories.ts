import { CATEGORY_TONE } from "@/lib/category-tones";
import type { PillTagTint } from "@/components/ui/pill-tag";

// 与 Prisma `CollaborationCategory` / `CollaborationWorkMode` / `CollaborationLocation` /
// `CollaborationStatus` / `CollaborationType` enum 一一对应。
// 这里手写一份是为了让 client component 可以导入而不拖入 Prisma runtime。
// 如果 schema.prisma 改了，这里需要同步。

export const COLLAB_CATEGORY_VALUES = [
  "AI_VIDEO_TEAM",
  "AI_COMIC_CREATOR",
  "AI_DRAMA_TEAM",
  "DIGITAL_HUMAN",
  "PROMPT_ENGINEER",
  "COMFYUI_WORKFLOW",
  "EDITOR",
  "COFOUNDER",
  "INVEST_BIZ",
  "OTHER",
] as const;

export type CollabCategoryValue = (typeof COLLAB_CATEGORY_VALUES)[number];

export type CollabCategoryMeta = {
  value: CollabCategoryValue;
  label: string;
  desc: string;
  /** @deprecated V1 tailwind classes — use `tint` with `<PillTag>` instead. */
  tone: string;
  emoji: string;
  /** V2 PillTag tint (DESIGN.md §7 7-tint vocabulary). */
  tint: PillTagTint;
};

export const COLLAB_CATEGORY_META: Record<CollabCategoryValue, CollabCategoryMeta> = {
  AI_VIDEO_TEAM: {
    value: "AI_VIDEO_TEAM",
    label: "AI 视频制作团队",
    desc: "完整成片团队：编剧 / 视觉 / 后期",
    tone: CATEGORY_TONE.indigo,
    emoji: "🎬",
    tint: "blue",
  },
  AI_COMIC_CREATOR: {
    value: "AI_COMIC_CREATOR",
    label: "AI 漫剧创作者",
    desc: "竖屏漫剧 · 分镜叙事节奏",
    tone: CATEGORY_TONE.fuchsia,
    emoji: "📖",
    tint: "violet",
  },
  AI_DRAMA_TEAM: {
    value: "AI_DRAMA_TEAM",
    label: "AI 短剧团队",
    desc: "竖屏微短剧 · 1-3 分钟一集",
    tone: CATEGORY_TONE.rose,
    emoji: "🎭",
    tint: "rose",
  },
  DIGITAL_HUMAN: {
    value: "DIGITAL_HUMAN",
    label: "数字人制作",
    desc: "数字人形象 + 口播 + 复用模板",
    tone: CATEGORY_TONE.emerald,
    emoji: "🧑‍💼",
    tint: "emerald",
  },
  PROMPT_ENGINEER: {
    value: "PROMPT_ENGINEER",
    label: "提示词工程师",
    desc: "Prompt 设计 / 调试 / 工作流",
    tone: CATEGORY_TONE.sky,
    emoji: "✨",
    tint: "cyan",
  },
  COMFYUI_WORKFLOW: {
    value: "COMFYUI_WORKFLOW",
    label: "ComfyUI 工作流搭建",
    desc: "节点图开发 · 节点封装 · 量产",
    tone: CATEGORY_TONE.cyan,
    emoji: "🧪",
    tint: "cyan",
  },
  EDITOR: {
    value: "EDITOR",
    label: "剪辑师",
    desc: "剪辑 · 调色 · 转场 · 字幕",
    tone: CATEGORY_TONE.amber,
    emoji: "🎞️",
    tint: "amber",
  },
  COFOUNDER: {
    value: "COFOUNDER",
    label: "联合创始人",
    desc: "长期搭子 / 股权合伙",
    tone: CATEGORY_TONE.violet,
    emoji: "🤝",
    tint: "violet",
  },
  INVEST_BIZ: {
    value: "INVEST_BIZ",
    label: "投资 / 商务合作",
    desc: "融资 · 渠道 · 品牌共创",
    tone: CATEGORY_TONE.yellowDeep,
    emoji: "💼",
    tint: "amber",
  },
  OTHER: {
    value: "OTHER",
    label: "其他合作",
    desc: "未归类的项目合作",
    tone: CATEGORY_TONE.slate,
    emoji: "📌",
    tint: "slate",
  },
};

export const COLLAB_CATEGORY_ORDER: CollabCategoryValue[] = [...COLLAB_CATEGORY_VALUES];

export function collabCategoryMeta(category: string): CollabCategoryMeta {
  return (
    COLLAB_CATEGORY_META[category as CollabCategoryValue] ??
    COLLAB_CATEGORY_META.OTHER
  );
}

// ───────── 合作方式 ─────────

export const COLLAB_WORK_MODE_VALUES = [
  "PROJECT",
  "FULL_TIME",
  "PART_TIME",
  "FREELANCE",
  "EQUITY",
  "ONE_OFF",
] as const;

export type CollabWorkModeValue = (typeof COLLAB_WORK_MODE_VALUES)[number];

export const COLLAB_WORK_MODE_LABEL: Record<CollabWorkModeValue, string> = {
  PROJECT: "项目制",
  FULL_TIME: "全职",
  PART_TIME: "兼职",
  FREELANCE: "外包",
  EQUITY: "合伙 / 股权",
  ONE_OFF: "一次性单子",
};

// ───────── 远程 / 线下 ─────────

export const COLLAB_LOCATION_VALUES = ["REMOTE", "ONSITE", "HYBRID"] as const;

export type CollabLocationValue = (typeof COLLAB_LOCATION_VALUES)[number];

export const COLLAB_LOCATION_LABEL: Record<CollabLocationValue, string> = {
  REMOTE: "远程",
  ONSITE: "线下",
  HYBRID: "远程 + 线下",
};

// ───────── 状态 ─────────

export const COLLAB_STATUS_VALUES = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;

export type CollabStatusValue = (typeof COLLAB_STATUS_VALUES)[number];

export const COLLAB_STATUS_LABEL: Record<CollabStatusValue, string> = {
  OPEN: "开放中",
  IN_PROGRESS: "已对接",
  CLOSED: "已关闭",
};

/** @deprecated V1 tailwind classes — use `COLLAB_STATUS_TINT` with `<PillTag>`. */
export const COLLAB_STATUS_TONE: Record<CollabStatusValue, string> = {
  OPEN: CATEGORY_TONE.emerald,
  IN_PROGRESS: CATEGORY_TONE.amber,
  CLOSED: CATEGORY_TONE.zinc,
};

export const COLLAB_STATUS_TINT: Record<CollabStatusValue, PillTagTint> = {
  OPEN: "emerald",
  IN_PROGRESS: "amber",
  CLOSED: "slate",
};

// ───────── 类型 (looking for / offering) ─────────

export const COLLAB_TYPE_VALUES = ["LOOKING_FOR", "OFFERING"] as const;

export type CollabTypeValue = (typeof COLLAB_TYPE_VALUES)[number];

export const COLLAB_TYPE_LABEL: Record<CollabTypeValue, string> = {
  LOOKING_FOR: "我正在找",
  OFFERING: "我可以提供",
};
