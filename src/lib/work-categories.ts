// 与 Prisma `WorkCategory` enum 一一对应。
// 这里手写一份是为了让 client component 可以导入而不拖入 Prisma runtime。
// 如果 schema.prisma 改了，这里需要同步。
export const WORK_CATEGORY_VALUES = [
  "AI_COMIC",
  "AI_DRAMA",
  "AI_ANIMATION",
  "DIGITAL_HUMAN",
  "ECOMMERCE_AD",
  "PRODUCT_SHOW",
  "KNOWLEDGE",
  "STORY",
  "EXPERIMENT",
] as const;

export type WorkCategoryValue = (typeof WORK_CATEGORY_VALUES)[number];

export type WorkCategoryMeta = {
  value: WorkCategoryValue;
  label: string;
  desc: string;
  // 卡片用的渐变色（封面缺省占位用）+ badge 配色
  cover: string;
  tone: string;
};

export const WORK_CATEGORY_META: Record<WorkCategoryValue, WorkCategoryMeta> = {
  AI_COMIC: {
    value: "AI_COMIC",
    label: "AI 漫剧",
    desc: "漫画分镜叙事，节奏明快",
    cover: "from-fuchsia-500/60 via-purple-700/60 to-slate-900/80",
    tone: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  },
  AI_DRAMA: {
    value: "AI_DRAMA",
    label: "AI 短剧",
    desc: "竖屏微短剧，1-3 分钟一集",
    cover: "from-rose-500/60 via-pink-700/60 to-slate-900/80",
    tone: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
  AI_ANIMATION: {
    value: "AI_ANIMATION",
    label: "AI 动画",
    desc: "二次元 / 三维动画风格",
    cover: "from-sky-500/60 via-blue-700/60 to-indigo-900/80",
    tone: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  DIGITAL_HUMAN: {
    value: "DIGITAL_HUMAN",
    label: "数字人视频",
    desc: "数字人口播 / 角色扮演",
    cover: "from-emerald-500/60 via-teal-700/60 to-slate-900/80",
    tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  ECOMMERCE_AD: {
    value: "ECOMMERCE_AD",
    label: "电商广告视频",
    desc: "5-15 秒商品种草短视频",
    cover: "from-amber-500/60 via-orange-700/60 to-red-900/80",
    tone: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  PRODUCT_SHOW: {
    value: "PRODUCT_SHOW",
    label: "产品展示视频",
    desc: "产品 360° / 功能演示",
    cover: "from-stone-400/60 via-amber-700/60 to-stone-950/80",
    tone: "bg-stone-500/15 text-stone-200 border-stone-500/30",
  },
  KNOWLEDGE: {
    value: "KNOWLEDGE",
    label: "知识讲解视频",
    desc: "科普 / 教程 / 知识可视化",
    cover: "from-blue-500/60 via-cyan-700/60 to-emerald-900/80",
    tone: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  },
  STORY: {
    value: "STORY",
    label: "故事类视频",
    desc: "叙事短片，剧情驱动",
    cover: "from-indigo-500/60 via-purple-700/60 to-slate-900/80",
    tone: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  },
  EXPERIMENT: {
    value: "EXPERIMENT",
    label: "实验短片",
    desc: "风格 / 工作流 / VFX 实验",
    cover: "from-yellow-500/60 via-orange-700/60 to-rose-900/80",
    tone: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
  },
};

export const WORK_CATEGORY_ORDER: WorkCategoryValue[] = [...WORK_CATEGORY_VALUES];

export function workCategoryMeta(category: string): WorkCategoryMeta {
  return (
    WORK_CATEGORY_META[category as WorkCategoryValue] ??
    WORK_CATEGORY_META.STORY
  );
}

// 卡片 / 下拉框中作者头像的色块（在没头像时使用）
export function authorTintFromName(name: string): string {
  const palettes = [
    "from-cyan-300 to-blue-500",
    "from-fuchsia-300 to-purple-500",
    "from-amber-300 to-orange-500",
    "from-emerald-300 to-teal-500",
    "from-rose-300 to-pink-500",
    "from-indigo-300 to-purple-500",
    "from-sky-300 to-cyan-500",
    "from-yellow-300 to-orange-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return palettes[hash % palettes.length];
}
