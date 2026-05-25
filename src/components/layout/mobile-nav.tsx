"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Home,
  MessageSquare,
  Sparkles,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";

const MOBILE_NAV_ITEMS = [
  { href: "/", label: "首页", icon: Home },
  { href: "/showcase", label: "广场", icon: Compass },
  { href: "/create-work", label: "发布", icon: Sparkles, primary: true },
  { href: "/tools", label: "工具", icon: Wrench },
  { href: "/messages", label: "消息", icon: MessageSquare },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="sticky bottom-0 z-40 flex h-14 w-full items-stretch border-t border-border/60 bg-background/85 backdrop-blur pb-safe lg:hidden"
      aria-label="主导航"
    >
      {MOBILE_NAV_ITEMS.map(({ href, label, icon: Icon, primary }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                primary
                  ? "bg-gradient-to-br from-cyan-400 to-blue-600 text-background shadow-[0_0_10px_-2px_rgba(56,189,248,0.5)]"
                  : active
                    ? "bg-primary/15"
                    : "bg-transparent",
              )}
            >
              <Icon className="size-4" />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
