import Link from "next/link";
import {
  Bookmark,
  Building2,
  Coins,
  Film,
  Gavel,
  Heart,
  LayoutDashboard,
  Package,
  Receipt,
} from "lucide-react";

import { requireUser } from "@/lib/auth/guard";

// Stage 7 · /me 个人中心：layout 集中处理 (a) 鉴权 (b) 顶部 tab nav。
// 子路由再各自跳 `?next=/me/...` 不必要 —— 任何 /me/* 都经过此 layout 鉴权。
// Stage 10.1：新增「我的商品」tab，对应卖家中心。
// Stage 10.4：新增「我的订单」tab，买家可查看历史订单与退款状态。
// Stage 10.5：新增「我的收益」tab，卖家可查看结算单 / 申请提现 / 绑定收款账号。
const NAV = [
  { href: "/me", label: "概览", icon: LayoutDashboard, exact: true },
  { href: "/me/works", label: "我的作品", icon: Film },
  { href: "/me/workflows", label: "我的商品", icon: Package },
  { href: "/me/orders", label: "我的订单", icon: Receipt },
  { href: "/me/earnings", label: "我的收益", icon: Coins },
  { href: "/me/organizations", label: "我的企业", icon: Building2 },
  { href: "/me/likes", label: "点赞收藏", icon: Heart },
  { href: "/me/bookmarks", label: "稍后再看", icon: Bookmark },
  // Stage 17.2：申诉中心（被下架内容的恢复申请）
  { href: "/me/appeals", label: "我的申诉", icon: Gavel },
];

export const dynamic = "force-dynamic";

export default async function MeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/me");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/30 px-6 py-3 sm:px-8">
        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="text-xs text-muted-foreground">
          <span className="text-foreground">{user.name}</span>{" "}
          <span className="text-muted-foreground/60">@{user.username}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
