import Link from "next/link";
import {
  Banknote,
  BadgeCheck,
  Coins,
  Film,
  Flag,
  Gavel,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  RotateCcw,
  ScrollText,
  Users,
  Wrench,
} from "lucide-react";

import { requireMod } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { countOpenReports, countMyAssignedReports } from "@/lib/reports/queries";

// 阶段 11 + Stage 5 + Stage 17.1：管理后台 layout。
// MOD（审核员）+ ADMIN 都可进入；layout NAV 按角色裁剪：
//   - ADMIN 看全部
//   - MOD 仅看「总览 / 举报 / 操作审计」，其它 tab 在 NAV 中隐藏；
//     直接访问 /admin/users 等仍走 requireAdmin 在页面层兜底（layout 不再统一管）。
// 未登录 → /auth/login；普通用户 → /?reason=mod-only。

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey?:
    | "reports"
    | "myQueue"
    | "clawbacks"
    | "orgVerifications"
    | "appeals";
  /** 仅 ADMIN 可见（MOD 不渲染） */
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { href: "/admin", label: "总览", icon: LayoutDashboard },
  { href: "/admin/users", label: "用户", icon: Users, adminOnly: true },
  { href: "/admin/posts", label: "帖子", icon: MessageSquare, adminOnly: true },
  { href: "/admin/works", label: "作品", icon: Film, adminOnly: true },
  {
    href: "/admin/collaborations",
    label: "合作需求",
    icon: Banknote,
    adminOnly: true,
  },
  {
    href: "/admin/reports?status=PENDING",
    label: "举报",
    icon: Flag,
    badgeKey: "reports",
  },
  {
    href: "/admin/reports?assignedToMe=1",
    label: "我处理的",
    icon: Flag,
    badgeKey: "myQueue",
  },
  { href: "/admin/tools", label: "工具库", icon: Wrench, adminOnly: true },
  // Stage 10.4：商业化订单管理（含退款入口）。
  { href: "/admin/orders", label: "订单", icon: Receipt, adminOnly: true },
  // Stage 10.5：结算管理（卖家提现 / 标记打款）。
  { href: "/admin/payouts", label: "结算", icon: Coins, adminOnly: true },
  // Stage 16.4：分润后退款的应收追讨。
  {
    href: "/admin/clawbacks?status=PENDING",
    label: "追讨",
    icon: RotateCcw,
    badgeKey: "clawbacks",
    adminOnly: true,
  },
  // Stage 11.2：企业认证审核。
  {
    href: "/admin/organizations/verifications",
    label: "企业认证",
    icon: BadgeCheck,
    badgeKey: "orgVerifications",
    adminOnly: true,
  },
  // Stage 17.2：内容申诉队列。
  {
    href: "/admin/appeals?status=PENDING",
    label: "内容申诉",
    icon: Gavel,
    badgeKey: "appeals",
    adminOnly: true,
  },
  { href: "/admin/audit-logs", label: "操作审计", icon: ScrollText },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireMod("/admin");
  const isAdminActor = actor.role === "ADMIN";

  const [
    openReports,
    myQueue,
    pendingVerifications,
    pendingClawbacks,
    pendingAppeals,
  ] = await Promise.all([
    countOpenReports().catch(() => 0),
    countMyAssignedReports(actor.id).catch(() => 0),
    isAdminActor
      ? prisma.organization
          .count({ where: { verificationStatus: "PENDING" } })
          .catch(() => 0)
      : 0,
    isAdminActor
      ? prisma.clawbackRequest
          .count({ where: { status: "PENDING" } })
          .catch(() => 0)
      : 0,
    isAdminActor
      ? prisma.contentAppeal
          .count({ where: { status: "PENDING" } })
          .catch(() => 0)
      : 0,
  ]);

  const visibleNav = NAV.filter((item) => !item.adminOnly || isAdminActor);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/30 px-6 py-3 sm:px-8">
        <nav className="flex flex-wrap items-center gap-1">
          {visibleNav.map(({ href, label, icon: Icon, badgeKey }) => {
            const badgeCount =
              badgeKey === "reports"
                ? openReports
                : badgeKey === "myQueue"
                  ? myQueue
                  : badgeKey === "orgVerifications"
                    ? pendingVerifications
                    : badgeKey === "clawbacks"
                      ? pendingClawbacks
                      : badgeKey === "appeals"
                        ? pendingAppeals
                        : 0;
            const showBadge = badgeCount > 0;
            return (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <Icon className="size-3.5" />
                {label}
                {showBadge && (
                  <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive/90 px-1 text-[10px] font-semibold text-white tabular-nums">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="text-xs text-muted-foreground">
          {isAdminActor ? "管理员" : "审核员"} ·{" "}
          <span className="text-foreground">{actor.name}</span>{" "}
          <span className="text-muted-foreground/60">@{actor.username}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
