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
  tone: string; // tailwind classes for the badge
};

export const POST_TYPE_META: Record<PostTypeValue, PostTypeMeta> = {
  DISCUSSION: {
    value: "DISCUSSION",
    label: "普通交流",
    desc: "日常想法、随手讨论",
    tone: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  },
  SHOWCASE: {
    value: "SHOWCASE",
    label: "作品展示",
    desc: "晒成片、分享镜头",
    tone: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  },
  COLLABORATION: {
    value: "COLLABORATION",
    label: "项目合作",
    desc: "招募、外包、组队",
    tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  TOOL_RECOMMEND: {
    value: "TOOL_RECOMMEND",
    label: "工具推荐",
    desc: "插件 / LoRA / 脚本",
    tone: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  TUTORIAL: {
    value: "TUTORIAL",
    label: "教程经验",
    desc: "工作流、踩坑、复盘",
    tone: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  },
  QUESTION: {
    value: "QUESTION",
    label: "提问求助",
    desc: "求助、问题、答疑",
    tone: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  },
  NEWS: {
    value: "NEWS",
    label: "行业资讯",
    desc: "模型动态、产品发布",
    tone: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
};

export const POST_TYPE_ORDER: PostTypeValue[] = [...POST_TYPE_VALUES];

export function postTypeMeta(type: string): PostTypeMeta {
  return (
    POST_TYPE_META[type as PostTypeValue] ?? POST_TYPE_META.DISCUSSION
  );
}
