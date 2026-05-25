import Link from "next/link";
import {
  Banknote,
  Film,
  LayoutDashboard,
  MessageSquare,
  Users,
  Wrench,
} from "lucide-react";

import { requireAdmin } from "@/lib/auth/guard";

// 阶段 11：所有 /admin/* 路由统一在 layout 里做管理员鉴权。
// 未登录 → /auth/login；普通用户 → /?reason=admin-only。
// 这样子页面就不用每个都写一遍 guard。

const NAV = [
  { href: "/admin", label: "总览", icon: LayoutDashboard },
  { href: "/admin/users", label: "用户", icon: Users },
  { href: "/admin/posts", label: "帖子", icon: MessageSquare },
  { href: "/admin/works", label: "作品", icon: Film },
  { href: "/admin/collaborations", label: "合作需求", icon: Banknote },
  { href: "/admin/tools", label: "工具库", icon: Wrench },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin("/admin");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/30 px-6 py-3 sm:px-8">
        <nav className="flex flex-wrap items-center gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
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
