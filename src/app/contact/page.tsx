import type { Metadata } from "next";

import {
  PageH2,
  StaticPageShell,
} from "@/components/static/static-page-shell";

export const metadata: Metadata = {
  title: "联系我们",
  description: "SeedLand 联系方式：合作、媒体、反馈、违规处理。",
};

export default function ContactPage() {
  return (
    <StaticPageShell
      eyebrow="Contact"
      title="联系我们"
      description="如有合作、商务、媒体或反馈意向，可通过下方任一渠道联系。我们会在 2 个工作日内回复。"
      updated="2026-06-03"
    >
      <PageH2>常用邮箱</PageH2>
      <ul>
        <li>
          <strong>商务合作</strong>：partners@seedland.dev
        </li>
        <li>
          <strong>媒体咨询</strong>：press@seedland.dev
        </li>
        <li>
          <strong>反馈 / Bug</strong>：support@seedland.dev
        </li>
        <li>
          <strong>违规举报</strong>：abuse@seedland.dev（也可使用站内任意内容的「举报」按钮）
        </li>
      </ul>

      <PageH2>站内反馈</PageH2>
      <p>
        登录后可在任意帖子 / 作品 / 用户主页上点击「⋯」→「举报」，进入举报对话框。举报会被自动分发到管理员队列，并保留追溯记录。
      </p>

      <PageH2>安全披露</PageH2>
      <p>
        如果你发现安全漏洞，请通过 <strong>security@seedland.dev</strong> 联系我们，并附最小可复现步骤。请勿在公开频道披露未修复的漏洞。
      </p>
    </StaticPageShell>
  );
}
