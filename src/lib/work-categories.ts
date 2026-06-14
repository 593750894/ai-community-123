import type { PillTagTint } from "@/components/ui/pill-tag";

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
  /** V2 PillTag tint (DESIGN.md §7 7-tint vocabulary). */
  tint: PillTagTint;
};

export const WORK_CATEGORY_META: Record<WorkCategoryValue, WorkCategoryMeta> = {
  AI_COMIC: {
    value: "AI_COMIC",
    label: "AI 漫剧",
    desc: "漫画分镜叙事，节奏明快",
    tint: "violet",
  },
  AI_DRAMA: {
    value: "AI_DRAMA",
    label: "AI 短剧",
    desc: "竖屏微短剧，1-3 分钟一集",
    tint: "rose",
  },
  AI_ANIMATION: {
    value: "AI_ANIMATION",
    label: "AI 动画",
    desc: "二次元 / 三维动画风格",
    tint: "blue",
  },
  DIGITAL_HUMAN: {
    value: "DIGITAL_HUMAN",
    label: "数字人视频",
    desc: "数字人口播 / 角色扮演",
    tint: "emerald",
  },
  ECOMMERCE_AD: {
    value: "ECOMMERCE_AD",
    label: "电商广告视频",
    desc: "5-15 秒商品种草短视频",
    tint: "amber",
  },
  PRODUCT_SHOW: {
    value: "PRODUCT_SHOW",
    label: "产品展示视频",
    desc: "产品 360° / 功能演示",
    tint: "slate",
  },
  KNOWLEDGE: {
    value: "KNOWLEDGE",
    label: "知识讲解视频",
    desc: "科普 / 教程 / 知识可视化",
    tint: "blue",
  },
  STORY: {
    value: "STORY",
    label: "故事类视频",
    desc: "叙事短片，剧情驱动",
    tint: "violet",
  },
  EXPERIMENT: {
    value: "EXPERIMENT",
    label: "实验短片",
    desc: "风格 / 工作流 / VFX 实验",
    tint: "amber",
  },
};

export const WORK_CATEGORY_ORDER: WorkCategoryValue[] = [...WORK_CATEGORY_VALUES];

export function workCategoryMeta(category: string): WorkCategoryMeta {
  return (
    WORK_CATEGORY_META[category as WorkCategoryValue] ??
    WORK_CATEGORY_META.STORY
  );
}
