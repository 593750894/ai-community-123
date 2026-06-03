import Link from "next/link";
import type { Metadata } from "next";

import {
  PageH2,
  PageH3,
  StaticPageShell,
} from "@/components/static/static-page-shell";

export const metadata: Metadata = {
  title: "关于 SeedLand",
  description:
    "SeedLand 是中文 AI 视频创作者社区，连接工具、工作流与一线创作者。",
};

export default function AboutPage() {
  return (
    <StaticPageShell
      eyebrow="About"
      title="关于 SeedLand"
      description="SeedLand 是面向中文 AI 视频与短剧创作者的社区与协作平台。"
      updated="2026-06-03"
    >
      <PageH2>我们做什么</PageH2>
      <p>
        SeedLand 把零散在各种工具、群聊、论坛中的 AI 视频创作经验聚合到一个地方：
      </p>
      <ul>
        <li>
          <strong>频道</strong>：按工具（Seedance / Kling / Veo / ComfyUI 等）和方向（AI 短剧 / 漫剧 / 新闻 / 招募）划分，避免大杂烩。
        </li>
        <li>
          <strong>作品广场</strong>：发布你的成片、获取同行反馈，所有作品默认带工作流注释。
        </li>
        <li>
          <strong>合作墙</strong>：找搭子、找客户、接项目；身份角色 + 标签让匹配更精准。
        </li>
        <li>
          <strong>工具库</strong>：社区评测的真实数据，避免被营销噪音掩盖。
        </li>
      </ul>

      <PageH2>我们的原则</PageH2>
      <PageH3>实战 &gt; 理论</PageH3>
      <p>
        所有「教程」必须包含可复现的参数、节点图或工作流文件。空话不发。
      </p>
      <PageH3>署名 &gt; 流量</PageH3>
      <p>
        转发他人作品必须留原作者署名；模型素材必须标明来源。详见 <Link href="/community/rules">社区公约</Link>。
      </p>
      <PageH3>创作者优先</PageH3>
      <p>
        平台收益的多数会回流给创作者，分成规则与 KPI 透明公开。详见 <Link href="/community/creator-program">创作者计划</Link>。
      </p>

      <PageH2>联系我们</PageH2>
      <p>
        合作 / 媒体 / 反馈：<Link href="/contact">联系页</Link>。
      </p>
    </StaticPageShell>
  );
}
