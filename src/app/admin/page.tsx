import Link from "next/link";
import {
  Banknote,
  ChevronRight,
  Coins,
  Film,
  Flag,
  MessageSquare,
  Receipt,
  Users,
  Wrench,
} from "lucide-react";

import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { pillTagTintClass, type PillTagTint } from "@/components/ui/pill-tag";
import { requireMod } from "@/lib/auth/guard";
import { prisma } from "@/lib/db";
import { getAdminPayoutOverview } from "@/lib/commerce/payouts";
import { countOpenReports } from "@/lib/reports/queries";
import { formatPrice } from "@/lib/commerce/schemas";

export const dynamic = "force-dynamic";

// 阶段 11 + Stage 5：管理后台首页 —— 核心数据 + 待处理举报。
// guard 在 layout 里已经做过，这里直接查 DB 即可。

async function getOverview() {
  const [users, posts, works, collabs, tools, openReports, paidOrders, payouts] =
    await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.work.count(),
      prisma.collaboration.count(),
      prisma.tool.count(),
      countOpenReports().catch(() => 0),
      // Stage 10.4：已付款订单数（含 REFUNDED 仍计入历史付款数）。
      prisma.order
        .count({ where: { status: { in: ["PAID", "REFUNDED"] } } })
        .catch(() => 0),
      // Stage 10.5：结算单总览（含待处理提现笔数）。
      getAdminPayoutOverview().catch(() => ({
        pendingNetCents: 0,
        availableNetCents: 0,
        requestedNetCents: 0,
        paidNetCents: 0,
        canceledNetCents: 0,
        pendingRequestCount: 0,
      })),
    ]);
  return {
    users,
    posts,
    works,
    collabs,
    tools,
    openReports,
    paidOrders,
    payouts,
  };
}

export default async function AdminPage() {
  // Stage 17.1：MOD 看不到全站营收 / 用户总数等敏感聚合，直接跳转其工作面板。
  const actor = await requireMod("/admin");
  if (actor.role !== "ADMIN") {
    redirect("/admin/reports?status=PENDING");
  }
  const overview = await getOverview();

  const cards: Array<{
    label: string;
    value: number;
    href: string;
    icon: typeof Users;
    tint: PillTagTint;
  }> = [
    {
      label: "用户",
      value: overview.users,
      href: "/admin/users",
      icon: Users,
      tint: "cyan",
    },
    {
      label: "帖子",
      value: overview.posts,
      href: "/admin/posts",
      icon: MessageSquare,
      tint: "blue",
    },
    {
      label: "作品",
      value: overview.works,
      href: "/admin/works",
      icon: Film,
      tint: "emerald",
    },
    {
      label: "合作需求",
      value: overview.collabs,
      href: "/admin/collaborations",
      icon: Banknote,
      tint: "amber",
    },
    {
      label: "工具",
      value: overview.tools,
      href: "/admin/tools",
      icon: Wrench,
      tint: "violet",
    },
    {
      label: "待处理举报",
      value: overview.openReports,
      href: "/admin/reports?status=PENDING",
      icon: Flag,
      tint: "rose",
    },
    {
      label: "已付款订单",
      value: overview.paidOrders,
      href: "/admin/orders?status=PAID",
      icon: Receipt,
      tint: "emerald",
    },
    {
      label: "待处理提现",
      value: overview.payouts.pendingRequestCount,
      href: "/admin/payouts?pendingRequest=1",
      icon: Coins,
      tint: "rose",
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
          {cards.map(({ label, value, href, icon: Icon, tint }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {value.toLocaleString()}
                </div>
              </div>
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${pillTagTintClass(tint)}`}
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
            {
              href: "/admin/reports?status=PENDING",
              title: "举报处理",
              desc: "审核用户提交的举报，处理或驳回。",
            },
            {
              href: "/admin/orders",
              title: "订单管理",
              desc: "查看订单 / 发起退款 / 追踪结算。",
            },
            {
              href: "/admin/payouts?pendingRequest=1",
              title: "结算管理",
              desc: `处理待提现 ${formatPrice(overview.payouts.requestedNetCents)} · 标记线下打款`,
            },
          ].map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group flex items-center justify-between rounded-xl border border-border bg-card/40 p-4 transition-all hover:border-primary/40 hover:bg-card/70"
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
