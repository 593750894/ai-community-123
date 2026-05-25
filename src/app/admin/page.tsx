import Link from "next/link";
import {
  Banknote,
  ChevronRight,
  Film,
  MessageSquare,
  Users,
  Wrench,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 阶段 11：管理后台首页 —— 展示最基础的几个核心数据。
// guard 在 layout 里已经做过，这里直接查 DB 即可。

async function getOverview() {
  const [users, posts, works, collabs, tools] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.work.count(),
    prisma.collaboration.count(),
    prisma.tool.count(),
  ]);
  return { users, posts, works, collabs, tools };
}

export default async function AdminPage() {
  const overview = await getOverview();

  const cards = [
    {
      label: "用户",
      value: overview.users,
      href: "/admin/users",
      icon: Users,
      tone: "text-cyan-300",
    },
    {
      label: "帖子",
      value: overview.posts,
      href: "/admin/posts",
      icon: MessageSquare,
      tone: "text-sky-300",
    },
    {
      label: "作品",
      value: overview.works,
      href: "/admin/works",
      icon: Film,
      tone: "text-emerald-300",
    },
    {
      label: "合作需求",
      value: overview.collabs,
      href: "/admin/collaborations",
      icon: Banknote,
      tone: "text-amber-300",
    },
    {
      label: "工具",
      value: overview.tools,
      href: "/admin/tools",
      icon: Wrench,
      tone: "text-violet-300",
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="管理后台"
        title="Admin · 总览"
        description="平台核心数据一览。点击卡片进入对应管理模块。"
      />

      <div className="space-y-6 px-6 py-6 sm:px-8">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map(({ label, value, href, icon: Icon, tone }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/70"
            >
              <div>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {value.toLocaleString()}
                </div>
              </div>
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ${tone}`}
              >
                <Icon className="size-4" />
              </span>
            </Link>
          ))}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              href: "/admin/users",
              title: "用户管理",
              desc: "查看用户列表与角色。",
            },
            {
              href: "/admin/posts",
              title: "帖子管理",
              desc: "查看 / 删除违规帖子。",
            },
            {
              href: "/admin/works",
              title: "作品管理",
              desc: "查看 / 删除违规作品。",
            },
            {
              href: "/admin/collaborations",
              title: "合作需求管理",
              desc: "修改状态、删除已失效的合作。",
            },
            {
              href: "/admin/tools",
              title: "工具库管理",
              desc: "录入新工具、下架老工具。",
            },
          ].map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group flex items-center justify-between rounded-xl border border-border/60 bg-card/40 p-4 transition-all hover:border-primary/40 hover:bg-card/70"
            >
              <div>
                <div className="text-sm font-medium group-hover:text-primary">
                  {m.title}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {m.desc}
                </div>
              </div>
              <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
