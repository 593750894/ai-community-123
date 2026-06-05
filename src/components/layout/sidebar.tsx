"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Coins,
  Film,
  Globe2,
  Hash,
  Heart,
  Home,
  LayoutDashboard,
  LayoutGrid,
  MessagesSquare,
  Package,
  Settings,
  Shield,
  Store,
  Users,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type SidebarChannel = {
  slug: string;
  name: string;
  icon: string | null;
};

export type SidebarTag = {
  tag: string;
  count: number;
};

type LinkItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const TOP_LINKS: LinkItem[] = [
  { href: "/", label: "首页", icon: Home },
  { href: "/community", label: "社区总览", icon: Globe2 },
  { href: "/showcase", label: "作品广场", icon: LayoutGrid, badge: "热" },
  { href: "/collaboration", label: "项目合作", icon: Users },
  { href: "/tools", label: "工具库", icon: Wrench },
  { href: "/marketplace", label: "工作流市集", icon: Store, badge: "新" },
  { href: "/pricing", label: "会员计划", icon: Coins },
  { href: "/messages", label: "消息中心", icon: MessagesSquare },
];

// Stage 7：/me 四个子页上线，浏览历史功能（PostView/WorkView）暂未实现，先从侧栏移除。
// Stage 10.1：新增「我的商品」入口（卖家管理上架工作流）。
const MY_LINKS: LinkItem[] = [
  { href: "/me", label: "个人中心", icon: LayoutDashboard },
  { href: "/me/works", label: "我的作品", icon: Film },
  { href: "/me/workflows", label: "我的商品", icon: Package },
  { href: "/me/likes", label: "点赞", icon: Heart },
  { href: "/me/bookmarks", label: "稍后再看", icon: Bookmark },
];

const ADMIN_LINK: LinkItem = { href: "/admin", label: "管理后台", icon: Shield };

export function Sidebar({
  hotChannels,
  popularTags,
}: {
  hotChannels: SidebarChannel[];
  popularTags: SidebarTag[];
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border/60 bg-background/40 px-3 py-4 lg:block">
      <ul className="space-y-0.5">
        {TOP_LINKS.map((item) => (
          <li key={item.href}>
            <ActiveLink item={item} active={isActive(item.href)} />
          </li>
        ))}
      </ul>

      <Divider />

      <SectionTitle>我的</SectionTitle>
      <ul className="space-y-0.5">
        {MY_LINKS.map((item) => (
          <li key={item.href}>
            <ActiveLink item={item} active={isActive(item.href)} />
          </li>
        ))}
      </ul>

      {hotChannels.length > 0 && (
        <>
          <Divider />
          <SectionTitle>频道</SectionTitle>
          <ul className="space-y-0.5">
            {hotChannels.map((ch) => (
              <li key={ch.slug}>
                <ChannelLink
                  ch={ch}
                  active={isActive(`/community/${ch.slug}`)}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      {popularTags.length > 0 && (
        <>
          <Divider />
          <SectionTitle>热门话题</SectionTitle>
          <ul className="space-y-0.5">
            {popularTags.map((t) => (
              <li key={t.tag}>
                <TagLink tag={t.tag} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Divider />

      <ul className="space-y-0.5">
        <li>
          <ActiveLink item={ADMIN_LINK} active={isActive(ADMIN_LINK.href)} />
        </li>
        <li>
          <ActiveLink
            item={{ href: "/settings", label: "设置", icon: Settings }}
            active={isActive("/settings")}
          />
        </li>
      </ul>
    </aside>
  );
}

function ActiveLink({ item, active }: { item: LinkItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active
            ? "text-primary"
            : "text-muted-foreground/80 group-hover:text-foreground",
        )}
      />
      <span className="truncate">{item.label}</span>
      {item.badge && (
        <span className="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function ChannelLink({
  ch,
  active,
}: {
  ch: SidebarChannel;
  active: boolean;
}) {
  return (
    <Link
      href={`/community/${ch.slug}`}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center text-[13px] leading-none"
      >
        {ch.icon ?? "🗂"}
      </span>
      <span className="truncate">{ch.name}</span>
    </Link>
  );
}

function TagLink({ tag }: { tag: string }) {
  return (
    <Link
      href={`/search?q=${encodeURIComponent(tag)}`}
      className="group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
    >
      <Hash className="size-4 shrink-0 text-muted-foreground/80 group-hover:text-foreground" />
      <span className="truncate">{tag}</span>
    </Link>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="my-3 border-t border-border/40" />;
}
