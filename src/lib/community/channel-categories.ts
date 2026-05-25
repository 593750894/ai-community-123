export interface ChannelDef {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface ChannelCategory {
  key: string;
  label: string;
  channels: ChannelDef[];
}

export const CHANNEL_CATEGORIES: ChannelCategory[] = [
  {
    key: "creative",
    label: "创作交流",
    channels: [
      {
        slug: "general",
        name: "综合交流",
        description: "AI 视频创作者日常交流、经验分享与自由讨论",
        icon: "💬",
        color: "#3b82f6",
      },
      {
        slug: "newbie-qa",
        name: "新手提问",
        description: "刚接触 AI 视频？在这里提问，社区伙伴帮你解答",
        icon: "🙋",
        color: "#22c55e",
      },
      {
        slug: "ai-short-drama",
        name: "AI 短剧交流",
        description: "AI 短剧制作流程、剧本创作与分镜讨论",
        icon: "🎬",
        color: "#f59e0b",
      },
      {
        slug: "ai-comic-drama",
        name: "AI 漫剧交流",
        description: "AI 漫画剧集制作、风格化角色与多帧叙事探索",
        icon: "📖",
        color: "#ec4899",
      },
    ],
  },
  {
    key: "tools",
    label: "工具工作流",
    channels: [
      {
        slug: "ai-video-tools",
        name: "AI 视频工具讨论",
        description: "各类 AI 视频生成工具对比、使用心得与技巧分享",
        icon: "🛠️",
        color: "#8b5cf6",
      },
      {
        slug: "prompts-workflow",
        name: "提示词与工作流",
        description: "提示词编写技巧、自动化工作流设计与最佳实践",
        icon: "✨",
        color: "#06b6d4",
      },
      {
        slug: "comfyui",
        name: "ComfyUI",
        description: "ComfyUI 节点、工作流分享与视频生成管线搭建",
        icon: "🔗",
        color: "#14b8a6",
      },
      {
        slug: "seedance-kling-veo",
        name: "Seedance / Kling / Veo",
        description: "Seedance、Kling、Veo 等主流 AI 视频模型讨论",
        icon: "🚀",
        color: "#f97316",
      },
    ],
  },
  {
    key: "showcase",
    label: "作品与项目",
    channels: [
      {
        slug: "showcase",
        name: "作品展示",
        description: "展示你的 AI 视频作品，获得社区反馈与灵感",
        icon: "🎨",
        color: "#a855f7",
      },
      {
        slug: "project-collab",
        name: "项目合作",
        description: "寻找合作伙伴，组建团队，共同完成创意项目",
        icon: "🤝",
        color: "#0ea5e9",
      },
      {
        slug: "hiring",
        name: "招募与接单",
        description: "发布需求、接单信息，连接创作者与客户",
        icon: "💼",
        color: "#64748b",
      },
    ],
  },
  {
    key: "industry",
    label: "行业资讯",
    channels: [
      {
        slug: "news",
        name: "行业资讯",
        description: "AI 视频行业动态、政策解读与市场趋势",
        icon: "📰",
        color: "#ef4444",
      },
      {
        slug: "tool-reviews",
        name: "工具评测",
        description: "AI 视频工具深度评测、横向对比与选型建议",
        icon: "🔍",
        color: "#10b981",
      },
      {
        slug: "business-cases",
        name: "商业案例",
        description: "AI 视频商业化落地案例、变现路径与经验分享",
        icon: "📈",
        color: "#eab308",
      },
    ],
  },
];

export const ALL_CHANNEL_DEFS = CHANNEL_CATEGORIES.flatMap((c) => c.channels);
