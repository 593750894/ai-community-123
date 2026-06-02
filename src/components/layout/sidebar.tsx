"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Film,
  Globe2,
  Hash,
  Heart,
  History,
  Home,
  LayoutGrid,
  MessagesSquare,
  Settings,
  Shield,
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
  { href: "/messages", label: "消息中心", icon: MessagesSquare },
];

const MY_LINKS: { label: string; icon: LinkItem["icon"] }[] = [
  { label: "我的作品", icon: Film },
  { label: "点赞收藏", icon: Heart },
  { label: "稍后再看", icon: Bookmark },
  { label: "浏览历史", icon: History },
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
          <li key={item.label}>
            <DisabledItem icon={item.icon} label={item.label} />
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
                <DisabledItem icon={Hash} label={t.tag} />
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
          <DisabledItem icon={Settings} label="设置" />
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

function DisabledItem({
  icon: Icon,
  label,
}: {
  icon: LinkItem["icon"];
  label: string;
}) {
  return (
    <span
      role="link"
      aria-disabled="true"
      title="即将上线"
      className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground/50"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground/40" />
      <span className="truncate">{label}</span>
    </span>
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
