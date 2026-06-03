import Link from "next/link";
import type { Metadata } from "next";

import {
  PageH2,
  PageH3,
  StaticPageShell,
} from "@/components/static/static-page-shell";

export const metadata: Metadata = {
  title: "服务条款",
  description: "SeedLand 服务条款 —— 使用本平台前请仔细阅读。",
};

export default function TermsPage() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="服务条款"
      description="使用 SeedLand 即代表你已阅读并同意以下条款。"
      updated="2026-06-03"
    >
      <PageH2>1. 账号与责任</PageH2>
      <p>
        你需要使用真实邮箱注册账号，并对账号下的所有行为负责。请勿与他人共享账号或转售账号。我们保留在违规情况下暂停或注销账号的权利。
      </p>

      <PageH2>2. 内容</PageH2>
      <PageH3>2.1 你的内容</PageH3>
      <p>
        你保留发布在 SeedLand 的内容的著作权。同时你授予我们一项可全球免费、可分发以承载平台功能（展示、分发、压缩、生成预览）的非独占许可。
      </p>
      <PageH3>2.2 禁止内容</PageH3>
      <ul>
        <li>违反所在地法律法规的内容；</li>
        <li>侵犯他人著作权、商标权、肖像权、隐私权的内容；</li>
        <li>色情、暴力、仇恨、欺诈、垃圾广告内容；</li>
        <li>使用 AI 生成的真人深度伪造（deepfake）内容，未取得本人书面授权的；</li>
        <li>未经允许爬取或对平台进行自动化滥用。</li>
      </ul>
      <PageH3>2.3 删除与申诉</PageH3>
      <p>
        我们可在收到合法投诉或违反公约的内容报告后删除内容、隐藏作品或限制账号。被处置方可通过 <Link href="/contact">联系页</Link> 申诉，我们将在 5 个工作日内回复。
      </p>

      <PageH2>3. 第三方服务</PageH2>
      <p>
        SeedLand 集成的 AI 视频生成、模型托管、对象存储、支付等第三方服务由各自提供商负责，相关条款另见各服务商。
      </p>

      <PageH2>4. 免责声明</PageH2>
      <p>
        平台以「现状」提供，我们不对停机、数据丢失、AI 生成结果的准确性或可商用性提供任何明示或默示担保。
      </p>

      <PageH2>5. 适用法律</PageH2>
      <p>
        本条款适用中华人民共和国法律。如发生争议，应由我方所在地有管辖权的法院管辖。
      </p>

      <PageH2>6. 联系方式</PageH2>
      <p>
        条款相关咨询请发送至 <strong>legal@seedland.dev</strong>。
      </p>
    </StaticPageShell>
  );
}
