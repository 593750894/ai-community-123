import Link from "next/link";
import {
  Banknote,
  Coins,
  Film,
  Flag,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  ScrollText,
  Users,
  Wrench,
} from "lucide-react";

import { requireAdmin } from "@/lib/auth/guard";
import { countOpenReports } from "@/lib/reports/queries";

// 阶段 11 + Stage 5：管理后台 layout + 举报未结数 badge。
// 所有 /admin/* 路由统一在 layout 里做管理员鉴权。
// 未登录 → /auth/login；普通用户 → /?reason=admin-only。

const NAV = [
  { href: "/admin", label: "总览", icon: LayoutDashboard },
  { href: "/admin/users", label: "用户", icon: Users },
  { href: "/admin/posts", label: "帖子", icon: MessageSquare },
  { href: "/admin/works", label: "作品", icon: Film },
  { href: "/admin/collaborations", label: "合作需求", icon: Banknote },
  {
    href: "/admin/reports?status=PENDING",
    label: "举报",
    icon: Flag,
    badgeKey: "reports" as const,
  },
  { href: "/admin/tools", label: "工具库", icon: Wrench },
  // Stage 10.4：商业化订单管理（含退款入口）。
  { href: "/admin/orders", label: "订单", icon: Receipt },
  // Stage 10.5：结算管理（卖家提现 / 标记打款）。
  { href: "/admin/payouts", label: "结算", icon: Coins },
  { href: "/admin/audit-logs", label: "操作审计", icon: ScrollText },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [admin, openReports] = await Promise.all([
    requireAdmin("/admin"),
    countOpenReports().catch(() => 0),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/30 px-6 py-3 sm:px-8">
        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map(({ href, label, icon: Icon, badgeKey }) => {
            const showBadge = badgeKey === "reports" && openReports > 0;
            return (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <Icon className="size-3.5" />
                {label}
                {showBadge && (
                  <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500/90 px-1 text-[10px] font-semibold text-white tabular-nums">
                    {openReports > 99 ? "99+" : openReports}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="text-xs text-muted-foreground">
          管理员 · <span className="text-foreground">{admin.name}</span>{" "}
          <span className="text-muted-foreground/60">@{admin.username}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
