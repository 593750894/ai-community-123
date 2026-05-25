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
  tone: string;
  emoji: string;
};

export const COLLAB_CATEGORY_META: Record<CollabCategoryValue, CollabCategoryMeta> = {
  AI_VIDEO_TEAM: {
    value: "AI_VIDEO_TEAM",
    label: "AI 视频制作团队",
    desc: "完整成片团队：编剧 / 视觉 / 后期",
    tone: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    emoji: "🎬",
  },
  AI_COMIC_CREATOR: {
    value: "AI_COMIC_CREATOR",
    label: "AI 漫剧创作者",
    desc: "竖屏漫剧 · 分镜叙事节奏",
    tone: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
    emoji: "📖",
  },
  AI_DRAMA_TEAM: {
    value: "AI_DRAMA_TEAM",
    label: "AI 短剧团队",
    desc: "竖屏微短剧 · 1-3 分钟一集",
    tone: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    emoji: "🎭",
  },
  DIGITAL_HUMAN: {
    value: "DIGITAL_HUMAN",
    label: "数字人制作",
    desc: "数字人形象 + 口播 + 复用模板",
    tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    emoji: "🧑‍💼",
  },
  PROMPT_ENGINEER: {
    value: "PROMPT_ENGINEER",
    label: "提示词工程师",
    desc: "Prompt 设计 / 调试 / 工作流",
    tone: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    emoji: "✨",
  },
  COMFYUI_WORKFLOW: {
    value: "COMFYUI_WORKFLOW",
    label: "ComfyUI 工作流搭建",
    desc: "节点图开发 · 节点封装 · 量产",
    tone: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    emoji: "🧪",
  },
  EDITOR: {
    value: "EDITOR",
    label: "剪辑师",
    desc: "剪辑 · 调色 · 转场 · 字幕",
    tone: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    emoji: "🎞️",
  },
  COFOUNDER: {
    value: "COFOUNDER",
    label: "联合创始人",
    desc: "长期搭子 / 股权合伙",
    tone: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    emoji: "🤝",
  },
  INVEST_BIZ: {
    value: "INVEST_BIZ",
    label: "投资 / 商务合作",
    desc: "融资 · 渠道 · 品牌共创",
    tone: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
    emoji: "💼",
  },
  OTHER: {
    value: "OTHER",
    label: "其他合作",
    desc: "未归类的项目合作",
    tone: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    emoji: "📌",
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

export const COLLAB_STATUS_TONE: Record<CollabStatusValue, string> = {
  OPEN: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  IN_PROGRESS: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  CLOSED: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

// ───────── 类型 (looking for / offering) ─────────

export const COLLAB_TYPE_VALUES = ["LOOKING_FOR", "OFFERING"] as const;

export type CollabTypeValue = (typeof COLLAB_TYPE_VALUES)[number];

export const COLLAB_TYPE_LABEL: Record<CollabTypeValue, string> = {
  LOOKING_FOR: "我正在找",
  OFFERING: "我可以提供",
};
