import type { PillTagTint } from "@/components/ui/pill-tag";

// 与 Prisma `PostType` enum 字符串值一一对应。
// 这里手写一份是为了让 client component 可以导入而不拖入 Prisma runtime (node:module)。
// 如果 schema.prisma 改了，这里需要同步。
export const POST_TYPE_VALUES = [
  "DISCUSSION",
  "SHOWCASE",
  "COLLABORATION",
  "TOOL_RECOMMEND",
  "TUTORIAL",
  "QUESTION",
  "NEWS",
] as const;

export type PostTypeValue = (typeof POST_TYPE_VALUES)[number];

export type PostTypeMeta = {
  value: PostTypeValue;
  label: string;
  desc: string;
  /** V2 PillTag tint (DESIGN.md §7 7-tint vocabulary). */
  tint: PillTagTint;
};

export const POST_TYPE_META: Record<PostTypeValue, PostTypeMeta> = {
  DISCUSSION: {
    value: "DISCUSSION",
    label: "普通交流",
    desc: "日常想法、随手讨论",
    tint: "slate",
  },
  SHOWCASE: {
    value: "SHOWCASE",
    label: "作品展示",
    desc: "晒成片、分享镜头",
    tint: "cyan",
  },
  COLLABORATION: {
    value: "COLLABORATION",
    label: "项目合作",
    desc: "招募、外包、组队",
    tint: "emerald",
  },
  TOOL_RECOMMEND: {
    value: "TOOL_RECOMMEND",
    label: "工具推荐",
    desc: "插件 / LoRA / 脚本",
    tint: "amber",
  },
  TUTORIAL: {
    value: "TUTORIAL",
    label: "教程经验",
    desc: "工作流、踩坑、复盘",
    tint: "blue",
  },
  QUESTION: {
    value: "QUESTION",
    label: "提问求助",
    desc: "求助、问题、答疑",
    tint: "violet",
  },
  NEWS: {
    value: "NEWS",
    label: "行业资讯",
    desc: "模型动态、产品发布",
    tint: "rose",
  },
};

export const POST_TYPE_ORDER: PostTypeValue[] = [...POST_TYPE_VALUES];

export function postTypeMeta(type: string): PostTypeMeta {
  return (
    POST_TYPE_META[type as PostTypeValue] ?? POST_TYPE_META.DISCUSSION
  );
}
