"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/account", label: "账户" },
  { href: "/settings/notifications", label: "通知" },
  { href: "/settings/privacy", label: "隐私" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b border-border bg-border/40 dark:bg-card/30 px-6 sm:px-8">
      <nav className="flex flex-wrap gap-1 py-2" aria-label="设置子导航">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center rounded-md px-3 py-1 text-xs transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
