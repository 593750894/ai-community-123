import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  Calendar,
  Edit3,
  ExternalLink,
  Film,
  Heart,
  Mail,
  MessageSquare,
  Sparkles,
  Wrench,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileEditDialog } from "@/components/auth/profile-edit-dialog";
import { startConversationAction } from "@/lib/messages/actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await getSession();
  const isOwner = session?.userId === userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      avatar: true,
      bio: true,
      role: true,
      industryRole: true,
      expertise: true,
      favoriteTools: true,
      portfolioLinks: true,
      contact: true,
      createdAt: true,
      _count: { select: { works: true, posts: true, collaborations: true } },
    },
  });

  if (!user) notFound();

  const works = await prisma.work.findMany({
    where: { authorId: userId, isPublic: true },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      durationSec: true,
      views: true,
      likeCount: true,
      ratio: true,
      model: true,
    },
  });

  const joined = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
  }).format(user.createdAt);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={`@${user.username}`}
        title={user.name}
        description={user.bio ?? "这位创作者还没有填写简介。"}
        actions={
          isOwner ? (
            <ProfileEditDialog
              initial={{
                name: user.name,
                avatar: user.avatar ?? "",
                bio: user.bio ?? "",
                industryRole: user.industryRole ?? "",
                expertise: user.expertise,
                favoriteTools: user.favoriteTools,
                portfolioLinks: user.portfolioLinks,
                contact: user.contact ?? "",
              }}
              trigger={
                <button className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 text-sm hover:bg-muted">
                  <Edit3 className="size-3.5" />
                  编辑资料
                </button>
              }
            />
          ) : (
            <form action={startConversationAction}>
              <input type="hidden" name="targetUserId" value={user.id} />
              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <MessageSquare className="size-3.5" />
                私信
              </button>
            </form>
          )
        }
      />

      <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-5">
          <div className="rounded-2xl border border-border/60 bg-card/40 p-5 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                user.avatar ??
                `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(user.username)}`
              }
              alt={user.name}
              className="mx-auto size-24 rounded-2xl border border-border/60 object-cover"
            />
            <div className="mt-3 text-base font-semibold">{user.name}</div>
            <div className="text-xs text-muted-foreground">@{user.username}</div>
            {user.industryRole && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary">
                <Briefcase className="size-3" />
                {user.industryRole}
              </div>
            )}
            <div className="mt-4 flex justify-around border-t border-border/40 pt-3 text-center">
              <Stat label="作品" value={user._count.works} />
              <Stat label="帖子" value={user._count.posts} />
              <Stat label="合作" value={user._count.collaborations} />
            </div>
          </div>

          <InfoCard
            icon={<Sparkles className="size-3.5" />}
            label="擅长领域"
            empty="尚未填写"
            items={user.expertise}
          />

          <InfoCard
            icon={<Wrench className="size-3.5" />}
            label="常用 AI 视频工具"
            empty="尚未填写"
            items={user.favoriteTools}
          />

          <div className="rounded-2xl border border-border/60 bg-card/40 p-4 text-xs text-muted-foreground">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/80">
              <Calendar className="size-3" />
              加入时间
            </div>
            <div className="text-foreground">{joined}</div>
            {user.contact && (
              <>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/80">
                  <Mail className="size-3" />
                  联系方式
                </div>
                <div className="break-all text-foreground">{user.contact}</div>
              </>
            )}
          </div>
        </aside>

        <main className="space-y-6">
          <section className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
              <ExternalLink className="size-3.5" />
              作品链接
            </h2>
            {user.portfolioLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {isOwner
                  ? "你还没有填写作品链接，点击右上角“编辑资料”补全。"
                  : "这位创作者还没有添加作品链接。"}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {user.portfolioLinks.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex max-w-full items-center gap-1.5 truncate text-sm text-primary hover:underline underline-offset-4"
                    >
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate">{url}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-medium">
                <Film className="size-3.5" />
                最近作品
                <span className="text-xs text-muted-foreground">
                  共 {user._count.works}
                </span>
              </h2>
              {user._count.works > works.length && (
                <Link
                  href={`/showcase?author=${user.username}`}
                  className="text-xs text-primary hover:underline underline-offset-4"
                >
                  查看全部 →
                </Link>
              )}
            </div>
            {works.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 bg-card/20 p-6 text-center text-sm text-muted-foreground">
                {isOwner
                  ? "你还没有发布作品。"
                  : "这位创作者还没有发布作品。"}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {works.map((w) => (
                  <div
                    key={w.id}
                    className="group overflow-hidden rounded-xl border border-border/60 bg-card/40 transition-colors hover:border-primary/40"
                  >
                    <div className="relative aspect-video w-full bg-gradient-to-br from-slate-800 to-slate-950">
                      {w.thumbnailUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={w.thumbnailUrl}
                          alt={w.title}
                          className="size-full object-cover opacity-90"
                        />
                      )}
                      {w.durationSec && (
                        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                          {w.durationSec}s
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 p-3">
                      <div className="line-clamp-1 text-sm font-medium">
                        {w.title}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{w.model}</span>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="size-3" />
                          {w.likeCount}
                        </span>
                        <span>{w.views} 次播放</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-base font-semibold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  items,
  empty,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/80">
        {icon}
        {label}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <span
              key={it}
              className="rounded-md border border-border/50 bg-background/60 px-2 py-0.5 text-xs"
            >
              {it}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
