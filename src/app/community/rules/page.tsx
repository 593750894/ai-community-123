import Link from "next/link";
import type { Metadata } from "next";

import {
  PageH2,
  PageH3,
  StaticPageShell,
} from "@/components/static/static-page-shell";

export const metadata: Metadata = {
  title: "社区公约",
  description: "SeedLand 社区公约 —— 我们如何一起把社区维持得健康、高质量。",
};

export default function CommunityRulesPage() {
  return (
    <StaticPageShell
      eyebrow="Community"
      title="社区公约"
      description="发帖、评论、合作前请阅读以下原则。违反者将被警告、删除内容或封禁账号。"
      updated="2026-06-03"
    >
      <PageH2>一、我们鼓励</PageH2>
      <ul>
        <li>
          <strong>带工作流的分享</strong>：贴出节点图、参数、模型版本、运行机器配置，比只展示成片更有价值。
        </li>
        <li>
          <strong>具体的反馈</strong>：指出「第 17s 的镜头切换不流畅」比「挺好的」更可贵。
        </li>
        <li>
          <strong>署名转发</strong>：转发他人的作品请保留原作者信息；引用 prompt / 模型素材请注明来源。
        </li>
        <li>
          <strong>正向氛围</strong>：新人提问不嘲笑、不阴阳怪气；老人指点不甩链接走人。
        </li>
      </ul>

      <PageH2>二、严令禁止</PageH2>
      <PageH3>1. 内容</PageH3>
      <ul>
        <li>违法、色情、暴力、仇恨、自残诱导内容；</li>
        <li>未授权的真人 deepfake（包括且不限于换脸、声音克隆）；</li>
        <li>侵犯他人著作权、商标权的作品或工作流；</li>
        <li>低质量复制粘贴、纯标题党、垃圾广告、引流到 18+ 平台。</li>
      </ul>
      <PageH3>2. 行为</PageH3>
      <ul>
        <li>骚扰其他用户（人身攻击、性骚扰、网络暴力）；</li>
        <li>滥用举报系统进行报复；</li>
        <li>用脚本或多账号刷赞、刷收藏、刷评论；</li>
        <li>冒充他人或平台官方身份。</li>
      </ul>

      <PageH2>三、处理流程</PageH2>
      <ol>
        <li>
          任何用户都可以对帖子 / 作品 / 评论 / 用户使用站内的「举报」按钮（详见 <Link href="/contact">联系页</Link>）。
        </li>
        <li>
          管理员在 24 小时内首次响应；违规等级分为：警告 / 隐藏 / 删除 / 禁言 7 天 / 封禁。
        </li>
        <li>
          被处置方可在 7 天内提交申诉，未在期限内提交申诉视为接受处理结果。
        </li>
      </ol>

      <PageH2>四、版权与合作</PageH2>
      <p>
        你保留在 SeedLand 上发布的作品的著作权。平台只在为提供服务（展示、压缩、生成预览图）所必需的最小范围内享有使用权。详见
        <Link href="/legal/terms"> 服务条款 </Link>。
      </p>

      <PageH2>五、特别声明</PageH2>
      <p>
        AI 视频领域发展极快，新的模型、新的滥用方式都可能出现。本公约会随着平台和行业一起迭代；最新版本以本页面公布为准。
      </p>
    </StaticPageShell>
  );
}
