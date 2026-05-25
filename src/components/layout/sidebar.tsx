"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Cpu,
  Film,
  Flame,
  Gamepad2,
  Globe2,
  GraduationCap,
  Hash,
  Heart,
  History,
  Home,
  Image as ImageIcon,
  LayoutGrid,
  ListVideo,
  MessagesSquare,
  Music2,
  Settings,
  Shield,
  Sparkles,
  Users,
  Video,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";

type SidebarItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

type SidebarSection = {
  title?: string;
  items: SidebarItem[];
};

const SECTIONS: SidebarSection[] = [
  {
    items: [
      { href: "/", label: "首页", icon: Home },
      { href: "/community", label: "社区总览", icon: Globe2 },
      { href: "/showcase", label: "作品广场", icon: LayoutGrid, badge: "热" },
      { href: "/collaboration", label: "项目合作", icon: Users },
      { href: "/tools", label: "工具库", icon: Wrench },
      { href: "/messages", label: "消息中心", icon: MessagesSquare },
    ],
  },
  {
    title: "我的",
    items: [
      { href: "/me/works", label: "我的作品", icon: Film },
      { href: "/me/likes", label: "点赞收藏", icon: Heart },
      { href: "/me/bookmarks", label: "稍后再看", icon: Bookmark },
      { href: "/me/history", label: "浏览历史", icon: History },
    ],
  },
  {
    title: "频道",
    items: [
      { href: "/c/showcase", label: "Showreel 精选", icon: Sparkles },
      { href: "/c/tutorials", label: "教程 / Workflow", icon: GraduationCap },
      { href: "/c/character", label: "角色 / 数字人", icon: Users },
      { href: "/c/scene", label: "场景 / 概念", icon: ImageIcon },
      { href: "/c/anime", label: "动画 / 番剧", icon: Video },
      { href: "/c/game", label: "游戏 CG", icon: Gamepad2 },
      { href: "/c/music", label: "MV / 音乐", icon: Music2 },
      { href: "/c/short", label: "短剧 / 广告", icon: ListVideo },
      { href: "/c/research", label: "前沿研究", icon: Cpu },
    ],
  },
  {
    title: "话题",
    items: [
      { href: "/t/seedance-2", label: "Seedance 2.0", icon: Hash },
      { href: "/t/veo-3", label: "Veo 3 对比", icon: Hash },
      { href: "/t/runway-gen4", label: "Runway Gen-4", icon: Hash },
      { href: "/t/kling-2", label: "可灵 2.0", icon: Hash },
      { href: "/t/pika", label: "Pika 工作流", icon: Hash },
      { href: "/t/comfyui", label: "ComfyUI", icon: Hash },
    ],
  },
  {
    items: [
      { href: "/admin", label: "管理后台", icon: Shield },
      { href: "/settings", label: "设置", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border/60 bg-background/40 px-3 py-4 lg:block">
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
        <Flame className="size-3.5" />
        <span className="truncate">本周热议 · Seedance 2.0 1080P</span>
      </div>

      {SECTIONS.map((section, idx) => (
        <div key={idx} className="mb-4 last:mb-0">
          {section.title && (
            <div className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </div>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
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
                </li>
              );
            })}
          </ul>
          {idx < SECTIONS.length - 1 && (
            <div className="mt-3 border-t border-border/40" />
          )}
        </div>
      ))}
    </aside>
  );
}
