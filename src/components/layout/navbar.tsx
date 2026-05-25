"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  LogOut,
  Menu,
  MessageSquare,
  Search,
  Sparkles,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

export type NavbarUser = {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
};

const NAV_ITEMS = [
  { href: "/", label: "首页" },
  { href: "/community", label: "社区" },
  { href: "/showcase", label: "作品广场" },
  { href: "/collaboration", label: "项目合作" },
  { href: "/tools", label: "工具库" },
];

export function Navbar({ user }: { user: NavbarUser | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-3 sm:gap-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="切换导航"
          aria-expanded={mobileOpen}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
        >
          {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>

        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-cyan-400 to-blue-600 text-background shadow-[0_0_18px_-2px_rgba(56,189,248,0.5)]">
            <Sparkles className="size-4" />
          </span>
          <span className="font-semibold tracking-tight">SeedLand</span>
          <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            V
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[15px] h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden flex-1 items-center justify-center lg:flex">
          <label className="group/search relative flex h-8 w-full max-w-md items-center rounded-lg border border-border/60 bg-card/40 px-2.5 text-sm transition-colors focus-within:border-primary/50 focus-within:bg-card/70">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              type="search"
              placeholder="搜索作品、创作者、标签..."
              className="ml-2 h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">
              /
            </kbd>
          </label>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href="/messages" aria-label="消息" />}
          >
            <MessageSquare className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            aria-label="通知"
            className="hidden sm:inline-flex"
          >
            <Bell className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/create-work" />}
            className="hidden sm:inline-flex"
          >
            <Upload className="size-3.5" />
            发布
          </Button>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/auth/login" />}
              >
                登录
              </Button>
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/auth/register" />}
                className="hidden sm:inline-flex"
              >
                注册
              </Button>
            </>
          )}
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
          <nav className="mx-auto flex w-full max-w-[1600px] flex-col px-3 py-2 sm:px-6">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}

function UserMenu({ user }: { user: NavbarUser }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-2 rounded-lg border border-border/60 bg-background px-2 text-sm transition-colors hover:bg-muted"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt={user.name}
            className="size-6 rounded-md object-cover"
          />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <UserIcon className="size-3.5" />
          </span>
        )}
        <span className="hidden max-w-[8rem] truncate sm:inline">{user.name}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-50 min-w-[180px] overflow-hidden rounded-lg border border-border/60 bg-popover shadow-lg"
        >
          <Link
            href={`/profile/${user.id}`}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <UserIcon className="size-3.5" />
            我的主页
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-3.5" />
              退出登录
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
