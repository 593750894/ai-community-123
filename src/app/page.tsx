import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Flame,
  Handshake,
  Heart,
  Sparkles,
  UserPlus,
  Video,
  Wand2,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkCard, type Work } from "@/components/feed/work-card";
import { PostCard, type PostCardData } from "@/components/feed/post-card";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getFollowingUserIds } from "@/lib/follows/queries";
import { loadInteractionState } from "@/lib/interactions/queries";
import {
  getLatestWorks,
  getRecommendedWorks,
  getWorksByCategory,
  getWorksByModel,
  type FeedWorkRow,
} from "@/lib/feeds/queries";
import type {
  WorkCategory,
  WorkModel,
} from "@/generated/prisma/client";
import type { WorkCategoryValue } from "@/lib/work-categories";
import { cn } from "@/lib/utils";

// 阶段 8：所有 tab 真实切换 — URL 驱动 + DB 查询。
type TabDef = {
  key: string;
  label: string;
  /** 启用的 tab 必须给出 kind，告诉服务端怎么查 */
  kind: "recommend" | "following" | "latest" | "category" | "model";
  /** kind=category 时填 WorkCategory；kind=model 时填 WorkModel */
  filter?: WorkCategory | WorkModel;
  emptyHint?: string;
};

const FEED_TABS: TabDef[] = [
  { key: "recommend", label: "推荐", kind: "recommend" },
  { key: "following", label: "关注", kind: "following" },
  { key: "latest", label: "最新", kind: "latest" },
  {
    key: "seedance-2",
    label: "Seedance 2.0",
    kind: "model",
    filter: "SEEDANCE_2_0",
    emptyHint: "暂时还没有使用 Seedance 2.0 的公开作品，去发布第一个吧。",
  },
  {
    key: "drama",
    label: "短剧",
    kind: "category",
    filter: "AI_DRAMA",
    emptyHint: "短剧分类下还没有作品，期待你的第一集。",
  },
  {
    key: "digital-human",
    label: "数字人",
    kind: "category",
    filter: "DIGITAL_HUMAN",
    emptyHint: "数字人分类下还没有作品。",
  },
  {
    key: "tutorial",
    label: "教程",
    kind: "category",
    filter: "KNOWLEDGE",
    emptyHint: "教程类作品还没上线，等你分享工作流。",
  },
  {
    key: "review",
    label: "评测",
    kind: "category",
    filter: "EXPERIMENT",
    emptyHint: "评测/实验作品暂无，欢迎做模型横评。",
  },
];

const QUICK_ENTRIES = [
  {
    href: "/create-work",
    icon: Wand2,
    title: "发布我的新作品",
    desc: "上传成片 + 简介 + 使用工具",
    tone: "from-cyan-500/20 to-blue-500/10 border-cyan-500/30",
  },
  {
    href: "/community",
    icon: Compass,
    title: "进入社区",
    desc: "教程 / 工作流 / 行业讨论",
    tone: "from-fuchsia-500/20 to-purple-500/10 border-fuchsia-500/30",
  },
  {
    href: "/collaboration",
    icon: Handshake,
    title: "找伙伴 / 接项目",
    desc: "导演、编剧、合成师、配音正在招募",
    tone: "from-amber-500/20 to-rose-500/10 border-amber-500/30",
  },
  {
    href: "/tools",
    icon: Wrench,
    title: "工具库导航",
    desc: "Seedance · Kling · ComfyUI · Suno",
    tone: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30",
  },
];

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const rawTab = sp.tab ?? "recommend";
  const activeTab = FEED_TABS.find((t) => t.key === rawTab) ?? FEED_TABS[0];

  const session = await getSession();

  return (
    <div className="flex flex-1 flex-col">
      <section className="relative isolate overflow-hidden border-b border-border/60 px-4 py-8 sm:px-8 sm:py-10">
        <div className="absolute inset-0 -z-10 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
        <div className="absolute inset-x-0 -top-20 -z-10 mx-auto h-72 max-w-3xl rounded-full bg-primary/20 blur-3xl" />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Badge variant="primary" size="lg">
              <Flame className="size-3" />
              AI 视频创作者社区
            </Badge>
            <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              <span className="text-gradient-brand">
                看作品
              </span>
              ·
              <span className="text-gradient-brand">
                聊工作流
              </span>
              <br className="hidden sm:block" />
              <span>组团队</span> · <span>接项目</span>
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
              围绕 Seedance 2.0 与主流视频大模型，连接导演、动画师、特效师与创作团队。一站式作品广场、社区论坛、项目合作、工具库与模型评测。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              nativeButton={false}
              render={<Link href="/create-work" />}
            >
              <Wand2 className="size-4" />
              发布作品
              <ArrowRight className="size-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              nativeButton={false}
              render={<Link href="/showcase" />}
            >
              <Sparkles className="size-4" />
              浏览广场
            </Button>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ENTRIES.map(({ href, icon: Icon, title, desc, tone }) => (
            <Link
              key={href}
              href={href}
              className={`group relative overflow-hidden rounded-xl border bg-gradient-to-br ${tone} p-4 transition-all hover:-translate-y-0.5`}
            >
              <Icon className="mb-3 size-5 text-foreground/90" />
              <div className="text-sm font-medium">{title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
              <ArrowRight className="absolute right-3 top-3 size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 px-4 py-6 sm:px-8">
        <div className="sticky top-14 z-20 -mx-4 flex items-center gap-1 overflow-x-auto border-b border-border/40 bg-background/85 px-4 py-2 backdrop-blur scroll-x-snap sm:-mx-8 sm:px-8">
          {FEED_TABS.map((t) => {
            const active = activeTab.key === t.key;
            return (
              <Link
                key={t.key}
                href={t.key === "recommend" ? "/" : `/?tab=${t.key}`}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {activeTab.kind === "following" ? (
          <FollowingFeed userId={session?.userId ?? null} />
        ) : (
          <WorksFeed tab={activeTab} viewerId={session?.userId ?? null} />
        )}
      </section>
    </div>
  );
}

function toWorkProp(row: FeedWorkRow): Work {
  return {
    id: row.id,
    title: row.title,
    thumbnailUrl: row.thumbnailUrl,
    category: row.category as WorkCategoryValue,
    description: row.description,
    tools: row.tools,
    likeCount: row.likeCount,
    bookmarkCount: row.bookmarkCount,
    durationSec: row.durationSec,
    ratio: ((row.ratio as Work["ratio"]) ?? "16:9"),
    author: row.author.name,
    authorId: row.author.id,
  };
}

async function WorksFeed({
  tab,
  viewerId,
}: {
  tab: TabDef;
  viewerId: string | null;
}) {
  let works: FeedWorkRow[] = [];
  switch (tab.kind) {
    case "recommend":
      works = await getRecommendedWorks();
      break;
    case "latest":
      works = await getLatestWorks();
      break;
    case "category":
      works = await getWorksByCategory(tab.filter as WorkCategory);
      break;
    case "model":
      works = await getWorksByModel(tab.filter as WorkModel);
      break;
    default:
      works = [];
  }

  if (works.length === 0) {
    return (
      <EmptyState
        icon={Video}
        title="还没有作品"
        description={
          tab.emptyHint ??
          "成为第一个发布作品的创作者，让你的 AI 视频被社区看到。"
        }
        action={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/create-work" />}
          >
            发布作品
          </Button>
        }
      />
    );
  }

  const interactions = await loadInteractionState({
    workIds: works.map((w) => w.id),
  });
  const signedIn = Boolean(viewerId);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
        {works.map((w) => (
          <WorkCard
            key={w.id}
            work={toWorkProp(w)}
            signedIn={signedIn}
            viewerId={viewerId}
            liked={interactions.likedWorkIds.has(w.id)}
            bookmarked={interactions.bookmarkedWorkIds.has(w.id)}
          />
        ))}
      </div>

      <div className="mt-2 flex justify-center">
        <Button
          variant="outline"
          size="lg"
          nativeButton={false}
          render={<Link href="/showcase" />}
        >
          浏览全部作品
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </>
  );
}

async function FollowingFeed({ userId }: { userId: string | null }) {
  if (!userId) {
    return (
      <EmptyState
        icon={UserPlus}
        title="登录后即可查看关注流"
        description="关注你感兴趣的创作者，他们发布的新帖会在这里聚合。"
        action={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/auth/login?next=${encodeURIComponent("/?tab=following")}`} />}
          >
            去登录
          </Button>
        }
      />
    );
  }

  const followingIds = await getFollowingUserIds(userId);
  if (followingIds.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="你还没有关注任何人"
        description="去社区或活跃创作者列表，关注感兴趣的人，这里就会出现他们的最新动态。"
        action={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/community" />}
          >
            去逛逛社区
          </Button>
        }
      />
    );
  }

  const rows = await prisma.post.findMany({
    where: { authorId: { in: followingIds } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      author: {
        select: { id: true, name: true, username: true, avatar: true, role: true },
      },
      channel: {
        select: { id: true, name: true, slug: true, icon: true, color: true },
      },
    },
  });

  const posts: PostCardData[] = rows.map((p) => ({
    id: p.id,
    title: p.title,
    content: p.content,
    type: p.type,
    videoUrl: p.videoUrl,
    imageUrl: p.imageUrl,
    views: p.views,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    bookmarkCount: p.bookmarkCount,
    pinned: p.pinned,
    createdAt: p.createdAt,
    author: p.author,
    channel: p.channel,
  }));

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="你关注的人最近还没有发布"
        description="再去关注几位活跃创作者，让首页热闹起来。"
      />
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          showChannel
          signedIn
          viewerId={userId}
        />
      ))}
    </div>
  );
}
