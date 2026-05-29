import "dotenv/config";

import bcrypt from "bcryptjs";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  BillingCycle,
  CollaborationCategory,
  CollaborationLocation,
  CollaborationStatus,
  CollaborationType,
  CollaborationWorkMode,
  PostType,
  PrismaClient,
  Role,
  ToolPricing,
  WorkCategory,
  WorkMode,
  WorkModel,
} from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to web/.env first.");
  process.exit(1);
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

// ─────────────────────────── 8 个示例用户 ───────────────────────────

const USERS = [
  {
    username: "admin",
    email: "admin@aivideohub.com",
    name: "管理员",
    bio: "SeedLand·V 平台管理员，AI 工具开发者。",
    role: Role.ADMIN,
    industryRole: "工具开发者",
    expertise: ["平台运营", "AI 工具开发", "全栈工程"],
    favoriteTools: ["ComfyUI", "Seedance 2.0", "Stable Diffusion"],
  },
  {
    username: "ai_creator",
    email: "creator@aivideohub.com",
    name: "林逸飞",
    bio: "全职 AI 视频创作者，用 Seedance 和 Runway 做短片，累计播放 500w+。",
    role: Role.MOD,
    industryRole: "AI 视频创作者",
    expertise: ["文生视频", "图生视频", "镜头调度"],
    favoriteTools: ["Seedance 2.0", "Runway", "Midjourney"],
  },
  {
    username: "ecom_client",
    email: "client@aivideohub.com",
    name: "张明远",
    bio: "电商视频服务商，帮品牌做 AI 产品短视频和数字人口播。",
    role: Role.USER,
    industryRole: "电商视频服务商",
    expertise: ["电商短视频", "产品展示", "批量生产"],
    favoriteTools: ["Seedance Fast", "HeyGen", "CapCut"],
  },
  {
    username: "comic_artist",
    email: "comic@seedland.dev",
    name: "漫漫子",
    bio: "AI 漫剧创作者，竖屏漫剧《雾港》作者，周更中。",
    role: Role.USER,
    industryRole: "AI 漫剧创作者",
    expertise: ["分镜叙事", "漫剧节奏", "角色一致性"],
    favoriteTools: ["Midjourney", "Seedance 2.0", "CapCut"],
  },
  {
    username: "drama_director",
    email: "drama@seedland.dev",
    name: "陈导",
    bio: "AI 短剧导演，已出品 3 部竖屏微短剧，累计 2000w 播放。",
    role: Role.USER,
    industryRole: "AI 短剧导演",
    expertise: ["短剧编导", "悬疑叙事", "Seedance 工作流"],
    favoriteTools: ["Seedance 2.0", "Kling", "ElevenLabs"],
  },
  {
    username: "digital_human",
    email: "avatar@seedland.dev",
    name: "数字人小K",
    bio: "数字人制作人，专注口播类数字人和虚拟主播制作。",
    role: Role.USER,
    industryRole: "数字人制作人",
    expertise: ["数字人定制", "口型驱动", "TTS 配音"],
    favoriteTools: ["HeyGen", "ElevenLabs", "Seedance 2.0"],
  },
  {
    username: "comfyui_dev",
    email: "comfy@seedland.dev",
    name: "老周工作流",
    bio: "ComfyUI 工作流搭建者，开源过 10+ 工作流模板。",
    role: Role.USER,
    industryRole: "ComfyUI 工作流搭建者",
    expertise: ["ComfyUI", "节点编程", "批量自动化"],
    favoriteTools: ["ComfyUI", "Stable Diffusion", "Seedance 2.0"],
  },
  {
    username: "ai_animator",
    email: "anim@seedland.dev",
    name: "Pixel 动画师",
    bio: "AI 动画师，擅长二次元和实验风格动画。Suno + Seedance 一条龙。",
    role: Role.USER,
    industryRole: "AI 动画师",
    expertise: ["AI 动画", "二次元风格", "MV 制作"],
    favoriteTools: ["Seedance 2.0", "Suno", "Midjourney"],
  },
] as const;

// ─────────────────────────── 12 个频道 ───────────────────────────

const CHANNELS = [
  { slug: "general", name: "综合交流", description: "自由讨论 AI 视频相关话题", icon: "💬", color: "#3b82f6" },
  { slug: "ai-video-tools", name: "AI 视频工具讨论", description: "各类 AI 视频工具的使用心得和对比", icon: "🛠️", color: "#8b5cf6" },
  { slug: "ai-comic", name: "AI 漫剧交流", description: "AI 漫剧创作经验分享", icon: "📖", color: "#f472b6" },
  { slug: "ai-drama", name: "AI 短剧交流", description: "AI 短剧编导与制作", icon: "🎬", color: "#ef4444" },
  { slug: "digital-human", name: "数字人/口播视频", description: "数字人形象与口播视频制作", icon: "🧑‍💻", color: "#06b6d4" },
  { slug: "ecommerce", name: "电商视频", description: "电商广告与产品展示视频", icon: "🛒", color: "#f59e0b" },
  { slug: "prompts-workflow", name: "提示词与工作流", description: "Prompt 技巧与 ComfyUI 工作流分享", icon: "✨", color: "#a78bfa" },
  { slug: "collaboration", name: "项目合作", description: "发布和寻找项目合作机会", icon: "🤝", color: "#10b981" },
  { slug: "hiring", name: "招募与接单", description: "招募团队成员或发布接单信息", icon: "📋", color: "#14b8a6" },
  { slug: "industry-news", name: "行业资讯", description: "AI 视频行业最新动态和资讯", icon: "📰", color: "#6366f1" },
  { slug: "showcase", name: "作品展示", description: "展示你的 AI 视频作品", icon: "🏆", color: "#22d3ee" },
  { slug: "newbie", name: "新手提问", description: "新手踩坑、提问、互助", icon: "🌱", color: "#86efac" },
] as const;

// ─────────────────────────── 15 个工具 ───────────────────────────

const TOOLS = [
  { slug: "runway", name: "Runway", category: "IMAGE_TO_VIDEO", url: "https://runwayml.com", pricing: ToolPricing.FREEMIUM, tags: ["图生视频", "电影感", "Gen-3"], desc: "Runway 旗舰视频生成模型，电影化运镜出彩，支持图生视频和动作迁移。", useCase: "MV / 短片 / 角色一致性场景" },
  { slug: "pika", name: "Pika", category: "TEXT_TO_VIDEO", url: "https://pika.art", pricing: ToolPricing.FREEMIUM, tags: ["文生视频", "风格化"], desc: "Pika Labs 出品，风格化与快速迭代友好，适合社媒创作。", useCase: "二创、Meme 视频、社媒爆款" },
  { slug: "kling", name: "Kling", category: "IMAGE_TO_VIDEO", url: "https://klingai.com", pricing: ToolPricing.FREEMIUM, tags: ["图生视频", "人像", "可灵"], desc: "可灵 AI，人像与物理一致性表现不错，适合真实人像驱动。", useCase: "真实人像驱动、短剧主角镜头" },
  { slug: "veo", name: "Veo", category: "TEXT_TO_VIDEO", url: "https://deepmind.google/technologies/veo/", pricing: ToolPricing.PAID, tags: ["文生视频", "Google", "高保真"], desc: "Google DeepMind 的高保真视频模型，物理真实度行业领先。", useCase: "对物理一致性要求高的场景：流体、布料、动物" },
  { slug: "seedance", name: "Seedance", category: "TEXT_TO_VIDEO", url: "https://www.volcengine.com/product/seedance", pricing: ToolPricing.PAID, tags: ["文生视频", "火山方舟", "首尾帧"], official: true, desc: "火山方舟出品的高质量视频生成模型，支持文生/图生/首尾帧/多模态参考。", useCase: "中长片 / 广告 / 短剧首选" },
  { slug: "jimeng", name: "即梦", category: "TEXT_TO_VIDEO", url: "https://jimeng.jianying.com", pricing: ToolPricing.FREEMIUM, tags: ["文生视频", "字节", "免费额度"], desc: "字节跳动出品的 AI 视频生成工具，中文友好，有免费额度。", useCase: "中文 prompt 友好、快速出片、社媒素材" },
  { slug: "midjourney", name: "Midjourney", category: "IMAGE_GEN", url: "https://midjourney.com", pricing: ToolPricing.PAID, tags: ["图像生成", "艺术风格", "首帧素材"], desc: "高质量风格化图像生成，常用于首尾帧素材和概念设计。", useCase: "概念图 / 首尾帧 / 艺术风格图" },
  { slug: "comfyui", name: "ComfyUI", category: "WORKFLOW", url: "https://www.comfy.org/", pricing: ToolPricing.FREE, tags: ["工作流", "开源", "节点图", "自动化"], desc: "节点式 AI 工作流编辑器，社区生态丰富，可搭建端到端流水线。", useCase: "自动化批量生产 / 图像视频流水线" },
  { slug: "heygen", name: "HeyGen", category: "DIGITAL_HUMAN", url: "https://heygen.com", pricing: ToolPricing.PAID, tags: ["数字人", "口型", "多语言"], desc: "数字人形象 + 口型驱动，多语言支持，适合口播和培训视频。", useCase: "口播 / 培训 / 电商短视频" },
  { slug: "elevenlabs", name: "ElevenLabs", category: "VOICE", url: "https://elevenlabs.io", pricing: ToolPricing.FREEMIUM, tags: ["TTS", "声音克隆", "配音"], desc: "高质量语音合成 + 多语言声音克隆，适合角色配音和口播。", useCase: "口播 / 角色配音 / 多语言版本" },
  { slug: "capcut", name: "CapCut", category: "EDIT", url: "https://www.capcut.cn/", pricing: ToolPricing.FREEMIUM, tags: ["剪辑", "字节", "自动字幕"], desc: "字节出品的剪辑工具，时间线 + AI 配乐 + 自动字幕。", useCase: "短视频 / 一人剪辑流水线" },
  { slug: "suno", name: "Suno", category: "MUSIC", url: "https://suno.com", pricing: ToolPricing.FREEMIUM, tags: ["音乐", "AI 编曲", "MV 配乐"], desc: "AI 编曲 + 演唱，MV 配乐利器，支持多种音乐风格。", useCase: "MV / 短剧 OST / 抖音配乐" },
  { slug: "stable-diffusion", name: "Stable Diffusion", category: "IMAGE_GEN", url: "https://stability.ai", pricing: ToolPricing.FREE, tags: ["图像生成", "开源", "本地部署"], desc: "开源图像生成模型，可本地部署 + 自定义 LoRA 训练。", useCase: "本地化部署 / 自训练 / 二次开发" },
  { slug: "tripo", name: "Tripo", category: "THREE_D", url: "https://www.tripo3d.ai", pricing: ToolPricing.FREEMIUM, tags: ["3D", "图生模型", "资产"], desc: "图片/文本生成 3D 模型，可衔接 UE5/Blender 动画工作流。", useCase: "AI 视频中的 3D 资产、UE5/Blender 素材" },
  { slug: "luma", name: "Luma", category: "IMAGE_TO_VIDEO", url: "https://lumalabs.ai/dream-machine", pricing: ToolPricing.FREEMIUM, tags: ["图生视频", "自然运镜"], desc: "Luma Dream Machine，自然运镜流畅，适合风景和慢节奏镜头。", useCase: "自然风景、慢节奏镜头" },
] as const;

// ─────────────────────────── 20 条帖子 ───────────────────────────

const POST_TEMPLATES: Array<{
  channel: string;
  title: string;
  content: string;
  type: PostType;
  videoUrl?: string;
  imageUrl?: string;
  userIdx: number;
}> = [
  // 综合交流
  { channel: "general", title: "2026 年 AI 视频行业大家怎么看？", content: "感觉今年工具迭代太快了，Veo 3、Seedance 2.0、Kling 都在卷，大家觉得下半年趋势会怎样？", type: PostType.DISCUSSION, userIdx: 1 },
  { channel: "general", title: "入行 AI 视频三个月的心得", content: "从零开始学 AI 视频制作，踩了很多坑，总结一些经验给新同学。工具选择 > 技巧打磨 > 内容策划。", type: PostType.DISCUSSION, userIdx: 4 },
  // AI 视频工具讨论
  { channel: "ai-video-tools", title: "Seedance 2.0 vs Runway Gen-3 详细对比", content: "从出片质量、运镜控制、成本三个维度做了详细对比，表格放正文。Seedance 在首尾帧控制上优势明显。", type: PostType.DISCUSSION, imageUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=seedance-vs-runway", userIdx: 1 },
  { channel: "ai-video-tools", title: "Veo 3 首批测试报告", content: "拿到了 Veo 3 的测试资格，物理真实度确实惊艳，但在风格化方面不如 Midjourney + Seedance 的组合。", type: PostType.NEWS, userIdx: 7 },
  // AI 漫剧交流
  { channel: "ai-comic", title: "AI 漫剧《雾港》第 5 话创作手记", content: "这一话尝试了多角色同框的场景，角色一致性用了 Midjourney 的 cref 参数锁定，效果不错。", type: PostType.SHOWCASE, videoUrl: "https://seedland.dev/sample/wugang-ep5.mp4", userIdx: 3 },
  { channel: "ai-comic", title: "漫剧分镜节奏的 3 个技巧", content: "1. 对话场景用中近景交替；2. 情绪转折用全景 + 特写跳切；3. 每话最后一帧要留悬念。", type: PostType.TUTORIAL, userIdx: 3 },
  // AI 短剧交流
  { channel: "ai-drama", title: "AI 短剧《地下车库》完结复盘", content: "12 集竖屏微短剧，全部用 Seedance 2.0 + Kling 出镜头。总结了选角、运镜、剪辑节奏的经验。", type: PostType.SHOWCASE, videoUrl: "https://seedland.dev/sample/parking-finale.mp4", userIdx: 4 },
  { channel: "ai-drama", title: "短剧用竖屏还是横屏？", content: "抖音投流建议 9:16 竖屏，B 站用 16:9 横屏。双版本同时出可以用 CapCut 一键裁切。", type: PostType.QUESTION, userIdx: 1 },
  // 数字人/口播视频
  { channel: "digital-human", title: "HeyGen 数字人口播避坑指南", content: "形象自然度取决于训练素材，至少准备 3 分钟正脸视频。口型同步延迟问题用 ElevenLabs 的 API 可以解决。", type: PostType.TUTORIAL, userIdx: 5 },
  { channel: "digital-human", title: "数字人形象定制的成本分析", content: "从免费方案（HeyGen 试用）到专业定制（¥8000-15000），各档位的效果对比。", type: PostType.DISCUSSION, userIdx: 5 },
  // 电商视频
  { channel: "ecommerce", title: "5 秒电商短视频自动化流水线", content: "产品图 → Midjourney 场景图 → Seedance Fast 生视频 → CapCut 加字幕和配乐。日产 50+ 条。", type: PostType.TUTORIAL, imageUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=ecom-pipeline", userIdx: 2 },
  { channel: "ecommerce", title: "电商视频的 ROI 怎么算？", content: "分享我们团队测出来的数据：AI 视频的 CPM 比传统拍摄低 60%，但转化率要看品类。", type: PostType.DISCUSSION, userIdx: 2 },
  // 提示词与工作流
  { channel: "prompts-workflow", title: "我的万能 Prompt 模板：风格/场景/主体/镜头/灯光/色调", content: "按这个顺序写 prompt 几乎不会翻车。附上 20 个实战案例。", type: PostType.TUTORIAL, userIdx: 1 },
  { channel: "prompts-workflow", title: "ComfyUI 批量出图工作流分享", content: "节点图开源了，支持批量换背景 + 统一风格 + 自动输出。一次设置好后全自动跑。", type: PostType.TOOL_RECOMMEND, userIdx: 6 },
  // 项目合作
  { channel: "collaboration", title: "招 AI 视频制作搭档，一起做 MV", content: "独立乐队，3 分 20 秒单曲，想做一支 AI 风格 MV。有 demo 和参考片，远程协作。", type: PostType.COLLABORATION, userIdx: 7 },
  // 招募与接单
  { channel: "hiring", title: "接单：Seedance + ComfyUI 全流程，¥10000/分钟起", content: "5 年视频经验，独立完成过 6 支商业短片。可承接 1-2 周交付的 MV / 广告 / 创意短片。", type: PostType.COLLABORATION, userIdx: 6 },
  // 行业资讯
  { channel: "industry-news", title: "Ark API 限流策略更新：并发上限调整为 8", content: "火山方舟今天更新了 Seedance API 的并发策略，从之前的 4 提升到 8。对批量出片的同学是好消息。", type: PostType.NEWS, userIdx: 0 },
  { channel: "industry-news", title: "Google Veo 3 正式开放 API 申请", content: "Veo 3 开始接受 API 申请了，价格比预期贵但质量确实顶。适合预算充足的商业项目。", type: PostType.NEWS, userIdx: 7 },
  // 作品展示
  { channel: "showcase", title: "首部 AI 短片《潮汐都市》上线", content: "用 Seedance 2.0 跑了 24 个镜头，3 天内出片。霓虹雨夜风格，欢迎来吐槽。", type: PostType.SHOWCASE, videoUrl: "https://seedland.dev/sample/tide-city.mp4", imageUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=tide-city", userIdx: 1 },
  // 新手提问
  { channel: "newbie", title: "新手必读：AI 视频参数到底是什么意思", content: "分辨率、比例、时长、种子（seed）、CFG Scale 一次讲清楚。附图解。", type: PostType.TUTORIAL, userIdx: 0 },
];

// ─────────────────────────── 10 个作品 ───────────────────────────

const WORKS = [
  { title: "潮汐都市 · 开场", desc: "霓虹雨夜镜头，慢镜推进，作为我新片的开场。", prompt: "neon-soaked metropolis at dusk, cinematic dolly-in, rain reflections on wet asphalt", category: WorkCategory.STORY, tools: ["Seedance", "Midjourney"], mode: WorkMode.TEXT_TO_VIDEO, model: WorkModel.SEEDANCE_2_0, resolution: "1080p", ratio: "16:9", duration: 5, userIdx: 1 },
  { title: "AI 漫剧《雾港》第 1 话", desc: "竖屏漫剧节奏，分镜驱动叙事。角色一致性用 Midjourney cref 锁定。", prompt: "vertical comic-style short drama, foggy harbor city, noir atmosphere", category: WorkCategory.AI_COMIC, tools: ["Seedance", "Midjourney", "ElevenLabs"], mode: WorkMode.IMAGE_TO_VIDEO, model: WorkModel.SEEDANCE_2_0, resolution: "1080p", ratio: "9:16", duration: 60, userIdx: 3 },
  { title: "AI 短剧《地下车库》预告", desc: "30 秒预告，竖屏短剧，悬疑题材。暗色调 + 脚步声音效。", prompt: "vertical micro-drama trailer, underground parking, suspense, dim lighting", category: WorkCategory.AI_DRAMA, tools: ["Seedance", "Kling", "CapCut"], mode: WorkMode.TEXT_TO_VIDEO, model: WorkModel.SEEDANCE_2_0, resolution: "1080p", ratio: "9:16", duration: 30, userIdx: 4 },
  { title: "数字人 Lina · 产品口播", desc: "30 秒数字人讲解，柔和棚拍灯光，可批量复用换文案。", prompt: "digital human Lina speaking to camera, soft studio lighting, professional", category: WorkCategory.DIGITAL_HUMAN, tools: ["HeyGen", "ElevenLabs"], mode: WorkMode.IMAGE_TO_VIDEO, model: WorkModel.SEEDANCE_2_0, resolution: "1080p", ratio: "16:9", duration: 30, userIdx: 5 },
  { title: "广告 · 香水 5 秒竖屏", desc: "电商广告样片，竖屏直接投流。旋转底座 + 柔光。", prompt: "perfume bottle on rotating pedestal, soft pink lighting, luxury feel", category: WorkCategory.ECOMMERCE_AD, tools: ["Seedance", "Midjourney"], mode: WorkMode.IMAGE_TO_VIDEO, model: WorkModel.SEEDANCE_FAST, resolution: "1080p", ratio: "9:16", duration: 5, userIdx: 2 },
  { title: "ComfyUI 批量出图 Demo", desc: "工作流演示视频，展示一次设置后全自动跑 50 张图的效果。", prompt: "screen recording style, ComfyUI node graph in action, fast generation", category: WorkCategory.KNOWLEDGE, tools: ["ComfyUI", "Stable Diffusion"], mode: WorkMode.TEXT_TO_VIDEO, model: WorkModel.SEEDANCE_FAST, resolution: "1080p", ratio: "16:9", duration: 120, userIdx: 6 },
  { title: "樱花列车 · 动画风", desc: "二次元风格，列车驶过樱花隧道，配 Suno 纯音乐。", prompt: "anime style, shinkansen passing through sakura tunnel, petals flying", category: WorkCategory.AI_ANIMATION, tools: ["Seedance", "Suno", "Midjourney"], mode: WorkMode.FIRST_LAST_FRAME, model: WorkModel.SEEDANCE_2_0, resolution: "720p", ratio: "16:9", duration: 6, userIdx: 7 },
  { title: "MV · 心跳城市", desc: "电子节奏的城市夜景 MV，BPM 128，霓虹脉冲。", prompt: "city skyline at night, neon pulsing to electronic beat bpm 128", category: WorkCategory.STORY, tools: ["Seedance", "Suno", "CapCut"], mode: WorkMode.TEXT_TO_VIDEO, model: WorkModel.SEEDANCE_2_0, resolution: "1080p", ratio: "16:9", duration: 6, userIdx: 7 },
  { title: "森林晨雾 · 产品底素材", desc: "自然风光小品，作为产品广告底素材使用。清晨阳光穿过松林。", prompt: "morning fog rolling through pine forest, soft sunbeams, cinematic", category: WorkCategory.PRODUCT_SHOW, tools: ["Seedance", "Luma"], mode: WorkMode.TEXT_TO_VIDEO, model: WorkModel.SEEDANCE_2_0, resolution: "1080p", ratio: "16:9", duration: 5, userIdx: 1 },
  { title: "三分钟讲清楚扩散模型", desc: "知识讲解，配图文 + 数字人讲述，科普向。", prompt: "explainer animation, diffusion model visualized step by step, clean style", category: WorkCategory.KNOWLEDGE, tools: ["Seedance", "Midjourney", "ElevenLabs"], mode: WorkMode.TEXT_TO_VIDEO, model: WorkModel.SEEDANCE_FAST, resolution: "1080p", ratio: "16:9", duration: 180, userIdx: 0 },
] as const;

// ─────────────────────────── 8 条合作需求 ───────────────────────────

const COLLABS = [
  {
    title: "招一个会写 Prompt 的搭子，共做 1 分钟短片",
    desc: "我擅长后期合成，正在做一支 1 分钟的赛博风格短片，缺一个能稳出 prompt 的小伙伴。交付物：30 段 5 秒镜头 + prompt 文档。可以分成。",
    type: CollaborationType.LOOKING_FOR,
    category: CollaborationCategory.PROMPT_ENGINEER,
    workMode: CollaborationWorkMode.PROJECT,
    location: CollaborationLocation.REMOTE,
    budget: "成片后分成 30%",
    contact: "微信: prompt_partner_01",
    tags: ["短片", "Prompt", "Seedance"],
    userIdx: 1,
  },
  {
    title: "AI 短剧《潮汐》第二季招团队，预计 12 集",
    desc: "竖屏微短剧，悬疑题材，已有完整剧本和分镜，需要：AI 视觉师 × 2、剪辑 × 1、配音 × 1。3 个月交付，按集结算。",
    type: CollaborationType.LOOKING_FOR,
    category: CollaborationCategory.AI_DRAMA_TEAM,
    workMode: CollaborationWorkMode.PROJECT,
    location: CollaborationLocation.HYBRID,
    budget: "¥18-30k / 集",
    contact: "邮箱: hello@yehang.studio",
    tags: ["短剧", "竖屏", "Seedance", "长期"],
    userIdx: 4,
  },
  {
    title: "找 AI 漫剧创作者，长期合作做平台原创",
    desc: "我们是一家漫剧厂牌，急需擅长分镜叙事、能稳定输出每周 1-2 话节奏的创作者。提供 IP 和编剧支持，作者负责画面落地。",
    type: CollaborationType.LOOKING_FOR,
    category: CollaborationCategory.AI_COMIC_CREATOR,
    workMode: CollaborationWorkMode.PART_TIME,
    location: CollaborationLocation.REMOTE,
    budget: "¥3-8k / 话 + 流量分成",
    contact: "微信: comic_studio_x",
    tags: ["漫剧", "分镜", "长期"],
    userIdx: 3,
  },
  {
    title: "电商品牌找数字人主播，30 秒口播模板",
    desc: "电商客户需要 1 个数字人形象 + 30 秒口播模板，可批量复用换文案。要求形象自然、表情流畅。",
    type: CollaborationType.LOOKING_FOR,
    category: CollaborationCategory.DIGITAL_HUMAN,
    workMode: CollaborationWorkMode.ONE_OFF,
    location: CollaborationLocation.REMOTE,
    budget: "¥8000-15000",
    contact: "联系: zhang@ecombrand.com",
    tags: ["数字人", "电商", "口播"],
    userIdx: 2,
  },
  {
    title: "需要 ComfyUI 工程师搭建产品图 → 视频流水线",
    desc: "电商团队，每天有 50+ 产品图需要自动转 5 秒短视频。希望搭建 ComfyUI 工作流：产品图 → 抠图 → 首尾帧 → Seedance Fast。",
    type: CollaborationType.LOOKING_FOR,
    category: CollaborationCategory.COMFYUI_WORKFLOW,
    workMode: CollaborationWorkMode.FREELANCE,
    location: CollaborationLocation.REMOTE,
    budget: "¥20000 一次性 + 后续维护",
    contact: "邮箱: ops@brand-lab.cn",
    tags: ["ComfyUI", "电商", "自动化"],
    userIdx: 2,
  },
  {
    title: "MV 项目招 AI 视频制作团队",
    desc: "独立乐队，单曲 3 分 20 秒，希望做一支 AI 风格 MV。已有 demo 和参考片，可面议风格细节。",
    type: CollaborationType.LOOKING_FOR,
    category: CollaborationCategory.AI_VIDEO_TEAM,
    workMode: CollaborationWorkMode.ONE_OFF,
    location: CollaborationLocation.REMOTE,
    budget: "¥12000-18000",
    contact: "微信: lighthouse_band",
    tags: ["MV", "音乐", "AI 视频"],
    userIdx: 7,
  },
  {
    title: "提供 Seedance + ComfyUI 全流程制作服务",
    desc: "5 年视频经验，独立完成过 6 支商业短片，可承接 1-2 周交付的 MV / 广告 / 创意短片。",
    type: CollaborationType.OFFERING,
    category: CollaborationCategory.AI_VIDEO_TEAM,
    workMode: CollaborationWorkMode.FREELANCE,
    location: CollaborationLocation.REMOTE,
    budget: "¥10000 / 分钟起",
    contact: "微信: mv_freelancer",
    tags: ["MV", "广告", "Seedance", "接单"],
    userIdx: 6,
  },
  {
    title: "AI 视频厂牌招联合创始人，技术 / 内容方向",
    desc: "团队 3 人，已有种子轮意向。寻找一位深度玩过 AI 视频工作流（Seedance / Runway / ComfyUI）的联合创始人，技术或内容方向均可。",
    type: CollaborationType.LOOKING_FOR,
    category: CollaborationCategory.COFOUNDER,
    workMode: CollaborationWorkMode.EQUITY,
    location: CollaborationLocation.HYBRID,
    budget: "股权 + 基本工资",
    contact: "微信: cofounder_seek_2026",
    tags: ["联合创始人", "股权", "厂牌"],
    userIdx: 0,
  },
] as const;

// ─────────────────────────── 30 条评论模板 ───────────────────────────

const COMMENT_POOL = [
  "效果很顶，求 prompt 分享！",
  "学习了，收藏一下。",
  "运镜控制得真好，用的什么参数？",
  "角色一致性怎么保持的？能展开讲讲吗？",
  "这个工作流太实用了，感谢分享。",
  "试了一下，确实有效，推荐给大家。",
  "想请教一下，首尾帧的分辨率需要一致吗？",
  "漫剧节奏很舒服，期待下一话！",
  "数字人口型同步做得很自然，是用哪个 TTS？",
  "电商视频这个流水线太猛了，日产 50 条。",
  "+1，也想知道成本大概多少。",
  "对比很详细，帮大忙了。",
  "新手看完终于搞懂了，谢谢！",
  "这个风格适合做品牌短片，下次试试。",
  "配乐和画面同步得很好，Suno 出的？",
  "能开源这个工作流吗？ComfyUI 版本要求多少？",
  "竖屏竖拍的效果比预期好很多。",
  "悬疑题材 + AI 生成，有种独特的氛围感。",
  "建议加上字幕效果，短视频平台完播率会更高。",
  "3D 资产那条路子打通了的话，效率会再上一个台阶。",
  "刚入坑，这篇帖子就是我需要的！",
  "请问这个价格包含几次修改？",
  "做了类似的项目，可以交流一下经验。",
  "物理真实度确实惊艳，但风格化不如 Seedance 灵活。",
  "种子轮进行到什么阶段了？有兴趣聊聊。",
  "分镜技巧第 2 点太实用了，马上用到自己的项目里。",
  "合作感兴趣，已加微信。",
  "这个对比表能做成长期更新的文档吗？",
  "Ark API 限流提升是好消息，终于不用排队了。",
  "五秒电商视频的转化数据能分享一下吗？",
];

// ─────────────────────────── 主流程 ───────────────────────────

async function main() {
  console.log("→ 清空数据…");
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.report.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.order.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.workflowItem.deleteMany(),
    prisma.organizationMember.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.membershipPlan.deleteMany(),
    prisma.bookmark.deleteMany(),
    prisma.like.deleteMany(),
    prisma.message.deleteMany(),
    prisma.conversationParticipant.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.work.deleteMany(),
    prisma.collaboration.deleteMany(),
    prisma.post.deleteMany(),
    prisma.channelMember.deleteMany(),
    prisma.channel.deleteMany(),
    prisma.tool.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // ──── Users ────
  console.log("→ 写入 users（密码统一为 seedland-dev-2026）…");
  const sharedHash = await hashPassword("seedland-dev-2026");
  const users = await Promise.all(
    USERS.map((u) =>
      prisma.user.create({
        data: {
          email: u.email,
          username: u.username,
          name: u.name,
          bio: u.bio,
          role: u.role,
          industryRole: u.industryRole,
          expertise: [...u.expertise],
          favoriteTools: [...u.favoriteTools],
          avatar: `https://api.dicebear.com/9.x/glass/svg?seed=${u.username}`,
          passwordHash: sharedHash,
        },
      })
    )
  );
  console.log(`   ✓ ${users.length} users`);

  // ──── Channels ────
  console.log("→ 写入 channels…");
  const channels = await Promise.all(
    CHANNELS.map((c, i) =>
      prisma.channel.create({
        data: {
          slug: c.slug,
          name: c.name,
          description: c.description,
          icon: c.icon,
          color: c.color,
          ownerId: users[i % users.length].id,
        },
      })
    )
  );
  console.log(`   ✓ ${channels.length} channels`);

  // ──── Channel memberships ────
  console.log("→ 写入 channel memberships（每人加入 6 个频道）…");
  let memberships = 0;
  for (const user of users) {
    const shuffled = [...channels].sort(() => Math.random() - 0.5).slice(0, 6);
    for (const ch of shuffled) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: ch.id, userId: user.id } },
        update: {},
        create: { channelId: ch.id, userId: user.id },
      });
      memberships++;
    }
  }
  console.log(`   ✓ ${memberships} memberships`);

  // ──── Tools ────
  console.log("→ 写入 tools…");
  const tools = await Promise.all(
    TOOLS.map((t, i) =>
      prisma.tool.create({
        data: {
          slug: t.slug,
          name: t.name,
          description: t.desc,
          url: t.url,
          category: t.category,
          useCase: t.useCase,
          pricing: t.pricing,
          tags: [...t.tags],
          isOfficial: "official" in t && t.official === true,
          createdById: users[i % users.length].id,
          logoUrl: `https://api.dicebear.com/9.x/icons/svg?seed=${t.slug}`,
        },
      })
    )
  );
  console.log(`   ✓ ${tools.length} tools`);

  // ──── Posts ────
  console.log("→ 写入 posts…");
  const channelBySlug = new Map(channels.map((c) => [c.slug, c]));
  const posts = await Promise.all(
    POST_TEMPLATES.map((p, i) => {
      const channel = channelBySlug.get(p.channel);
      if (!channel) throw new Error(`channel not found: ${p.channel}`);
      return prisma.post.create({
        data: {
          channelId: channel.id,
          authorId: users[p.userIdx].id,
          title: p.title,
          content: p.content,
          type: p.type,
          videoUrl: p.videoUrl ?? null,
          imageUrl: p.imageUrl ?? null,
          views: 50 + Math.floor(Math.random() * 1000),
          pinned: i === 0,
        },
      });
    })
  );
  console.log(`   ✓ ${posts.length} posts`);

  // ──── Comments（30 条）────
  console.log("→ 写入 comments…");
  let commentIdx = 0;
  const allComments = [];
  for (const post of posts) {
    const n = Math.min(1 + Math.floor(Math.random() * 3), 30 - commentIdx);
    if (n <= 0) break;
    for (let k = 0; k < n; k++) {
      const authorIdx = (POST_TEMPLATES[posts.indexOf(post)].userIdx + k + 1) % users.length;
      const author = users[authorIdx];
      if (author.id === post.authorId) continue;
      const comment = await prisma.comment.create({
        data: {
          postId: post.id,
          authorId: author.id,
          content: COMMENT_POOL[commentIdx % COMMENT_POOL.length],
        },
      });
      allComments.push(comment);
      commentIdx++;
      if (commentIdx >= 30) break;
    }
    if (commentIdx >= 30) break;
  }
  console.log(`   ✓ ${allComments.length} comments`);

  // ──── Works ────
  console.log("→ 写入 works…");
  const works = await Promise.all(
    WORKS.map((w, i) =>
      prisma.work.create({
        data: {
          authorId: users[w.userIdx].id,
          title: w.title,
          description: w.desc,
          videoUrl: `https://seedland.dev/sample/${i + 1}.mp4`,
          thumbnailUrl: `https://api.dicebear.com/9.x/shapes/svg?seed=work-${i}`,
          prompt: w.prompt,
          category: w.category,
          tools: [...w.tools],
          mode: w.mode,
          model: w.model,
          resolution: w.resolution,
          ratio: w.ratio,
          durationSec: w.duration,
          views: 100 + Math.floor(Math.random() * 2000),
        },
      })
    )
  );
  console.log(`   ✓ ${works.length} works`);

  // ──── Collaborations ────
  console.log("→ 写入 collaborations…");
  const collabs = await Promise.all(
    COLLABS.map((c, i) => {
      const status =
        i === COLLABS.length - 1
          ? CollaborationStatus.CLOSED
          : i === COLLABS.length - 2
            ? CollaborationStatus.IN_PROGRESS
            : CollaborationStatus.OPEN;
      return prisma.collaboration.create({
        data: {
          authorId: users[c.userIdx].id,
          title: c.title,
          description: c.desc,
          type: c.type,
          category: c.category,
          workMode: c.workMode,
          location: c.location,
          status,
          budget: c.budget,
          contact: c.contact,
          tags: [...c.tags],
        },
      });
    })
  );
  console.log(`   ✓ ${collabs.length} collaborations`);

  // ──── Likes + Bookmarks ────
  console.log("→ 写入 likes + bookmarks…");
  let likeCount = 0;
  let bookmarkCount = 0;
  const postLikeCounts = new Map<string, number>();
  const postBookmarkCounts = new Map<string, number>();
  const workLikeCounts = new Map<string, number>();
  const workBookmarkCounts = new Map<string, number>();

  for (const user of users) {
    // 给随机 5 个帖子点赞
    const postTargets = [...posts].sort(() => Math.random() - 0.5).slice(0, 5);
    for (const p of postTargets) {
      if (p.authorId === user.id) continue;
      await prisma.like.upsert({
        where: { userId_postId: { userId: user.id, postId: p.id } },
        update: {},
        create: { userId: user.id, postId: p.id },
      });
      postLikeCounts.set(p.id, (postLikeCounts.get(p.id) ?? 0) + 1);
      likeCount++;
    }
    // 收藏 2 个帖子
    const postBookmarkTargets = [...posts].sort(() => Math.random() - 0.5).slice(0, 2);
    for (const p of postBookmarkTargets) {
      if (p.authorId === user.id) continue;
      await prisma.bookmark.upsert({
        where: { userId_postId: { userId: user.id, postId: p.id } },
        update: {},
        create: { userId: user.id, postId: p.id },
      });
      postBookmarkCounts.set(p.id, (postBookmarkCounts.get(p.id) ?? 0) + 1);
      bookmarkCount++;
    }
    // 给随机 3 个作品点赞
    const workTargets = [...works].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const w of workTargets) {
      if (w.authorId === user.id) continue;
      await prisma.like.upsert({
        where: { userId_workId: { userId: user.id, workId: w.id } },
        update: {},
        create: { userId: user.id, workId: w.id },
      });
      workLikeCounts.set(w.id, (workLikeCounts.get(w.id) ?? 0) + 1);
      likeCount++;
    }
    // 收藏 2 个作品
    const workBookmarkTargets = [...works].sort(() => Math.random() - 0.5).slice(0, 2);
    for (const w of workBookmarkTargets) {
      if (w.authorId === user.id) continue;
      await prisma.bookmark.upsert({
        where: { userId_workId: { userId: user.id, workId: w.id } },
        update: {},
        create: { userId: user.id, workId: w.id },
      });
      workBookmarkCounts.set(w.id, (workBookmarkCounts.get(w.id) ?? 0) + 1);
      bookmarkCount++;
    }
  }
  console.log(`   ✓ ${likeCount} likes, ${bookmarkCount} bookmarks`);

  // ──── 更新计数 ────
  console.log("→ 更新 likeCount / commentCount / bookmarkCount…");
  // 帖子评论数
  const postCommentCounts = new Map<string, number>();
  for (const c of allComments) {
    postCommentCounts.set(c.postId, (postCommentCounts.get(c.postId) ?? 0) + 1);
  }
  for (const post of posts) {
    await prisma.post.update({
      where: { id: post.id },
      data: {
        likeCount: postLikeCounts.get(post.id) ?? 0,
        commentCount: postCommentCounts.get(post.id) ?? 0,
        bookmarkCount: postBookmarkCounts.get(post.id) ?? 0,
      },
    });
  }
  for (const work of works) {
    await prisma.work.update({
      where: { id: work.id },
      data: {
        likeCount: workLikeCounts.get(work.id) ?? 0,
        bookmarkCount: workBookmarkCounts.get(work.id) ?? 0,
      },
    });
  }
  console.log("   ✓ counts synced");

  // ──── Conversations + Messages（3 个会话，10 条消息）────
  console.log("→ 写入 conversations + messages…");

  // 会话 1: creator 和 漫剧作者 讨论角色一致性
  const conv1 = await prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId: users[1].id }, { userId: users[3].id }],
      },
    },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: conv1.id, senderId: users[1].id, content: "你那条漫剧的角色一致性做得很好，用的 Midjourney cref 吗？" },
      { conversationId: conv1.id, senderId: users[3].id, content: "对，cref + sref 双锁，然后用 Seedance 的首尾帧把动作连起来。" },
      { conversationId: conv1.id, senderId: users[1].id, content: "明白了，我试试这个思路。你那个分镜模板能分享一下吗？" },
      { conversationId: conv1.id, senderId: users[3].id, content: "可以，晚点整理一份发你。" },
    ],
  });

  // 会话 2: 电商客户和 ComfyUI 开发者 讨论工作流
  const conv2 = await prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId: users[2].id }, { userId: users[6].id }],
      },
    },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: conv2.id, senderId: users[2].id, content: "老周，你那个 ComfyUI 批量出图工作流还接定制吗？" },
      { conversationId: conv2.id, senderId: users[6].id, content: "接的，你们大概什么需求？日产量多少？" },
      { conversationId: conv2.id, senderId: users[2].id, content: "每天 50+ 产品图转 5 秒短视频，需要自动抠图 + 换背景 + 出片。" },
      { conversationId: conv2.id, senderId: users[6].id, content: "可以做，Seedance Fast + ComfyUI 搭一条流水线就行。我先出个方案给你看。" },
    ],
  });

  // 会话 3: 动画师和短剧导演 讨论 MV 合作
  const conv3 = await prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId: users[7].id }, { userId: users[4].id }],
      },
    },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: conv3.id, senderId: users[7].id, content: "陈导，看到你发的 MV 合作帖了，我这边可以做动画风格的镜头。" },
      { conversationId: conv3.id, senderId: users[4].id, content: "太好了，你之前那个樱花列车的风格就很合适，方便这周聊一下吗？" },
    ],
  });
  console.log("   ✓ 3 conversations, 10 messages");

  // ──── Membership plans（商业化基础参考数据）────
  console.log("→ 写入 membership plans…");
  const plans = await prisma.$transaction([
    prisma.membershipPlan.create({
      data: {
        slug: "free",
        name: "免费会员",
        description: "基础功能体验，适合新用户。",
        priceCents: 0,
        cycle: BillingCycle.MONTHLY,
        features: ["发帖 / 评论", "上传作品", "工具库浏览"],
        sortOrder: 0,
      },
    }),
    prisma.membershipPlan.create({
      data: {
        slug: "pro-monthly",
        name: "Pro 月度",
        description: "解锁高级数据看板、工作流市场佣金减免、优先客服。",
        priceCents: 4900,
        cycle: BillingCycle.MONTHLY,
        features: [
          "全部免费功能",
          "工作流市场上架免抽成（前 3 单）",
          "AI 工具优惠码",
          "高级数据看板",
        ],
        sortOrder: 1,
      },
    }),
    prisma.membershipPlan.create({
      data: {
        slug: "pro-annual",
        name: "Pro 年度",
        description: "Pro 月度年付版，立省 ¥119，赠 6 次工作流首推位。",
        priceCents: 47900,
        cycle: BillingCycle.ANNUAL,
        features: [
          "全部 Pro 月度功能",
          "工作流首推位 × 6",
          "线下活动优先入场",
        ],
        sortOrder: 2,
      },
    }),
  ]);
  console.log(`   ✓ ${plans.length} membership plans`);

  // ──── 汇总 ────
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.channel.count(),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.work.count(),
    prisma.collaboration.count(),
    prisma.tool.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.like.count(),
    prisma.bookmark.count(),
    prisma.membershipPlan.count(),
  ]);
  console.log("\n┌─────────────────┬────────┐");
  console.log("│ table           │ rows   │");
  console.log("├─────────────────┼────────┤");
  const labels = [
    "users",
    "channels",
    "posts",
    "comments",
    "works",
    "collaborations",
    "tools",
    "conversations",
    "messages",
    "likes",
    "bookmarks",
    "membership_plans",
  ];
  labels.forEach((label, i) => {
    console.log(`│ ${label.padEnd(15)} │ ${String(counts[i]).padStart(6)} │`);
  });
  console.log("└─────────────────┴────────┘");

  console.log("\n测试账号:");
  console.log("  admin@aivideohub.com   (ADMIN)");
  console.log("  creator@aivideohub.com (MOD)");
  console.log("  client@aivideohub.com  (USER)");
  console.log("  密码统一: seedland-dev-2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
