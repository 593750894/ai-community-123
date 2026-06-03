import Link from "next/link";
import type { Metadata } from "next";

import {
  PageH2,
  PageH3,
  StaticPageShell,
} from "@/components/static/static-page-shell";

export const metadata: Metadata = {
  title: "隐私政策",
  description: "SeedLand 隐私政策 —— 我们收集、使用、保护数据的方式。",
};

export default function PrivacyPage() {
  return (
    <StaticPageShell
      eyebrow="Legal"
      title="隐私政策"
      description="本政策说明我们收集、使用、共享和保护你个人数据的方式。"
      updated="2026-06-03"
    >
      <PageH2>1. 我们收集的信息</PageH2>
      <PageH3>1.1 你主动提供</PageH3>
      <ul>
        <li>注册：邮箱、用户名、显示名、密码（加盐哈希存储，永不明文）；</li>
        <li>资料：头像、简介、行业角色、技能标签、作品集链接；</li>
        <li>发布内容：帖子、作品、评论、合作、私信。</li>
      </ul>
      <PageH3>1.2 自动收集</PageH3>
      <ul>
        <li>访问日志：IP、User-Agent、访问时间、来源页（用于反作弊和安全审计，30 天滚动）；</li>
        <li>设备标识符：仅在你登录时生成 session cookie，HttpOnly + SameSite=Lax；</li>
        <li>性能指标：匿名的页面加载时间、错误堆栈（不含 PII）。</li>
      </ul>

      <PageH2>2. 我们如何使用</PageH2>
      <ul>
        <li>提供与维护服务（账号、内容、通知、推荐）；</li>
        <li>反作弊、反垃圾、风险控制；</li>
        <li>聚合统计（不可识别个人的同人数据）用于产品改进；</li>
        <li>仅在你明确同意后，发送营销或活动信息。</li>
      </ul>

      <PageH2>3. 我们如何共享</PageH2>
      <p>我们不出售你的个人数据。仅在以下情况共享：</p>
      <ul>
        <li>服务商：对象存储（Cloudflare R2）、邮件、支付等必要的处理者，受合同约束；</li>
        <li>法律要求：根据有效的法院命令、行政机关请求；</li>
        <li>你的授权：你主动公开发布的内容（如作品、帖子）。</li>
      </ul>

      <PageH2>4. 数据安全</PageH2>
      <p>
        我们使用 HTTPS 传输、加盐哈希存储密码、最小权限访问数据库，并启用对象存储侧的服务端加密。
        尽管如此，互联网传输不能 100% 安全；如发现账号异常，请尽快通过 <Link href="/contact">联系页</Link> 与我们沟通。
      </p>

      <PageH2>5. 你的权利</PageH2>
      <ul>
        <li>查看 / 导出你的资料和内容；</li>
        <li>更正或删除你的个人信息；</li>
        <li>注销账号（不可恢复，已发布并被他人引用的内容可能保留可见副本）；</li>
        <li>反对营销类信息推送。</li>
      </ul>
      <p>
        如需行使任何权利，请发送邮件至 <strong>privacy@seedland.dev</strong>。
      </p>

      <PageH2>6. 未成年人</PageH2>
      <p>
        本平台不向 14 岁以下的未成年人提供服务。如发现误注册情况，请联系我们删除。
      </p>

      <PageH2>7. 政策更新</PageH2>
      <p>
        我们可能会更新本政策。重大变更会在站内公告并以邮件形式提醒受影响的注册用户。
      </p>
    </StaticPageShell>
  );
}
