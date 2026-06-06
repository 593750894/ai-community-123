import Link from "next/link";
import type { Metadata } from "next";

import {
  PageH2,
  PageH3,
  StaticPageShell,
} from "@/components/static/static-page-shell";
import {
  PAYOUT_HOLD_DAYS,
  PLATFORM_FEE_PERCENT_DISPLAY,
} from "@/lib/commerce/config";

export const metadata: Metadata = {
  title: "创作者计划",
  description: "SeedLand 创作者计划 —— 分成机制、曝光扶持和申请方式。",
};

export default function CreatorProgramPage() {
  const sellerSharePercent = (100 - Number(PLATFORM_FEE_PERCENT_DISPLAY)).toFixed(
    Number(PLATFORM_FEE_PERCENT_DISPLAY) % 1 === 0 ? 0 : 1,
  );
  return (
    <StaticPageShell
      eyebrow="Program"
      title="创作者计划"
      description="为持续输出优质内容的 AI 视频创作者提供分成、曝光、工具补贴和早期产品试用。"
      updated="2026-06-06"
    >
      <PageH2>为什么要做这个计划</PageH2>
      <p>
        我们相信，平台只能在创作者持续产出优质内容时才有价值。SeedLand 把站内付费收入的大部分回流给创作者，并通过工具补贴 + 推荐位曝光放大每一位创作者的产出效率。
      </p>

      <PageH2>分成与结算规则</PageH2>
      <ul>
        <li>
          工作流市集订单成交后，平台默认抽成 <strong>{PLATFORM_FEE_PERCENT_DISPLAY}%</strong>，创作者实得 <strong>{sellerSharePercent}%</strong>。
        </li>
        <li>
          每笔订单付款后进入 <strong>{PAYOUT_HOLD_DAYS} 天冷藏期</strong>（覆盖买家退款窗口），冷藏期满后结算单自动转入「可申请提现」。
        </li>
        <li>
          创作者在 <Link href="/me/earnings">我的收益</Link> 中绑定支付宝 / 微信 / 银行卡后可申请提现；管理员核对后线下打款并标记结算单为「已打款」。
        </li>
        <li>
          全额退款会自动取消对应的未结算结算单；部分退款不影响结算金额。
        </li>
      </ul>

      <PageH2>三档权益</PageH2>
      <PageH3>种子创作者（Seed）</PageH3>
      <ul>
        <li>主页 + 作品页带「种子创作者」认证标识；</li>
        <li>每周一次首页热门推荐位（与社区运营共同评选）；</li>
        <li>开通付费工作流商品上架资格。</li>
      </ul>
      <PageH3>认证创作者（Pro）</PageH3>
      <ul>
        <li>种子档全部权益；</li>
        <li>付费工作流分成比例 75%（默认 50%）；</li>
        <li>专属频道客服与举报快速通道；</li>
        <li>合作伙伴模型 / API 折扣或免费额度。</li>
      </ul>
      <PageH3>合作伙伴（Partner）</PageH3>
      <ul>
        <li>认证档全部权益；</li>
        <li>定制分成方案（视项目而定）；</li>
        <li>共同营销活动、线下沙龙、媒体宣发；</li>
        <li>新功能内测白名单。</li>
      </ul>

      <PageH2>申请条件</PageH2>
      <ul>
        <li>至少发布 5 件作品 / 10 篇带工作流的帖子；</li>
        <li>30 天内无任何被处置的违规记录；</li>
        <li>个人主页填写完整（行业角色、技能、作品集）。</li>
      </ul>

      <PageH2>如何申请</PageH2>
      <p>
        在 <Link href="/contact">联系页</Link> 发送申请邮件，标题写「创作者计划申请 + 你的用户名」，附 3 件代表作链接和 1 段不超过 200 字的自我介绍。我们在 5 个工作日内回复。
      </p>

      <PageH2>退出与降级</PageH2>
      <p>
        加入后如出现严重违反 <Link href="/community/rules">社区公约</Link> 的行为，将直接降级或退出。
        创作者本人也可以随时申请退出，已结算的收益不受影响。
      </p>
    </StaticPageShell>
  );
}
