import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  Clock,
  Contact,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserCircle,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { cn, formatRelativeTime } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/session";
import {
  COLLAB_LOCATION_LABEL,
  COLLAB_STATUS_LABEL,
  COLLAB_STATUS_TONE,
  COLLAB_STATUS_VALUES,
  COLLAB_TYPE_LABEL,
  COLLAB_WORK_MODE_LABEL,
  collabCategoryMeta,
  type CollabCategoryValue,
  type CollabLocationValue,
  type CollabStatusValue,
  type CollabTypeValue,
  type CollabWorkModeValue,
} from "@/lib/collaborations/categories";
import { authorTintFromName } from "@/lib/work-categories";
import { updateCollaborationStatusAction } from "@/lib/collaborations/actions";

export const dynamic = "force-dynamic";

async function getCollaboration(id: string) {
  return prisma.collaboration.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          bio: true,
          industryRole: true,
          contact: true,
        },
      },
    },
  });
}

async function getMoreInCategory(category: string, excludeId: string) {
  return prisma.collaboration.findMany({
    where: {
      id: { not: excludeId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: category as any,
      status: "OPEN",
    },
    orderBy: { createdAt: "desc" },
    take: 4,
    include: {
      author: { select: { id: true, name: true } },
    },
  });
}

export default async function CollaborationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [collab, currentUser] = await Promise.all([
    getCollaboration(id),
    getCurrentUser(),
  ]);
  if (!collab) notFound();

  const meta = collabCategoryMeta(collab.category);
  const tint = authorTintFromName(collab.author.name);
  const moreLikeThis = await getMoreInCategory(collab.category, collab.id);

  const isOwner = currentUser?.id === collab.authorId;
  const isLoggedIn = !!currentUser;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={`合作详情 · ${meta.label}`}
        title={collab.title}
        description={`由 ${collab.author.name} 于 ${formatRelativeTime(collab.createdAt)}发布`}
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/collaboration" />}
          >
            <ArrowLeft className="size-3.5" />
            返回合作市场
          </Button>
        }
      />

      <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1fr_340px]">
        <main className="space-y-6">
          {/* 标题卡 */}
          <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card/60 to-card/20">
            <div className="space-y-3 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    meta.tone,
                  )}
                >
                  <span aria-hidden>{meta.emoji}</span>
                  {meta.label}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    COLLAB_STATUS_TONE[collab.status as CollabStatusValue],
                  )}
                >
                  {COLLAB_STATUS_LABEL[collab.status as CollabStatusValue]}
                </span>
                <span className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 text-xs text-muted-foreground">
                  {COLLAB_TYPE_LABEL[collab.type as CollabTypeValue]}
                </span>
              </div>

              <h1 className="text-xl font-semibold leading-snug sm:text-2xl">
                {collab.title}
              </h1>

              <div className="grid gap-2 border-y border-border/40 py-3 text-xs sm:grid-cols-3">
                <MetaRow icon={<Banknote className="size-3.5" />} label="预算" value={collab.budget ?? "面议"} />
                <MetaRow
                  icon={<Briefcase className="size-3.5" />}
                  label="合作方式"
                  value={COLLAB_WORK_MODE_LABEL[collab.workMode as CollabWorkModeValue]}
                />
                <MetaRow
                  icon={<MapPin className="size-3.5" />}
                  label="远程 / 线下"
                  value={COLLAB_LOCATION_LABEL[collab.location as CollabLocationValue]}
                />
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
                  需求描述
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/95">
                  {collab.description}
                </p>
              </div>

              {collab.tags.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80">
                    标签
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {collab.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 联系方式 */}
          <section className="rounded-2xl border border-border/60 bg-card/40 p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Contact className="size-4 text-primary" />
              联系方式
            </div>
            {collab.contact ? (
              isLoggedIn ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    发布者预留的联系方式
                  </div>
                  <p className="mt-1 select-all break-all font-mono text-sm text-foreground/95">
                    {collab.contact}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    请文明对接，避免广告骚扰。
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="size-3.5" />
                    登录后可查看联系方式
                  </div>
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/auth/login?next=/collaboration/${collab.id}`} />}
                  >
                    登录查看
                  </Button>
                </div>
              )
            ) : (
              <p className="text-xs text-muted-foreground">
                发布者未留下联系方式，可通过站内私信沟通。
              </p>
            )}
          </section>

          {/* 发布者操作（仅发布者可见） */}
          {isOwner && (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-200">
                <ShieldCheck className="size-4" />
                发布者操作
              </div>
              <p className="mb-3 text-xs text-amber-100/80">
                你是这条合作需求的发布者，可以更新状态以便其他人知道当前进度。
              </p>
              <div className="flex flex-wrap gap-2">
                {COLLAB_STATUS_VALUES.map((s) => (
                  <form key={s} action={updateCollaborationStatusAction}>
                    <input type="hidden" name="id" value={collab.id} />
                    <input type="hidden" name="status" value={s} />
                    <button
                      type="submit"
                      disabled={collab.status === s}
                      className={cn(
                        "inline-flex h-7 items-center rounded-md border px-2.5 text-xs transition-colors",
                        collab.status === s
                          ? `${COLLAB_STATUS_TONE[s as CollabStatusValue]} cursor-default`
                          : "border-border/60 bg-background hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      标记为 {COLLAB_STATUS_LABEL[s as CollabStatusValue]}
                    </button>
                  </form>
                ))}
              </div>
            </section>
          )}

          {/* 同类型其他合作 */}
          {moreLikeThis.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium">
                同类型「{meta.label}」的其他开放需求
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {moreLikeThis.map((m) => (
                  <Link
                    key={m.id}
                    href={`/collaboration/${m.id}`}
                    className="rounded-xl border border-border/60 bg-card/40 p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="line-clamp-1 text-sm font-medium">{m.title}</div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {m.description}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{m.author.name}</span>
                      <span>{m.budget ?? "面议"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-4">
          {/* 分类卡 */}
          <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">
              合作类型
            </div>
            <div className={cn("rounded-lg border p-3", meta.tone)}>
              <div className="text-sm font-semibold">
                <span className="mr-1.5" aria-hidden>{meta.emoji}</span>
                {meta.label}
              </div>
              <p className="mt-1 text-xs opacity-85">{meta.desc}</p>
            </div>
            <Link
              href={`/collaboration?category=${collab.category as CollabCategoryValue}`}
              className="mt-3 block text-center text-xs text-primary hover:underline"
            >
              浏览全部「{meta.label}」 →
            </Link>
          </section>

          {/* 作者卡 */}
          <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/80">
              <UserCircle className="size-3.5" />
              发布者
            </div>
            <div className="flex items-center gap-3">
              {collab.author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={collab.author.avatar}
                  alt={collab.author.name}
                  className="size-12 rounded-xl border border-border/60"
                />
              ) : (
                <span
                  className={cn(
                    "flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-medium text-black/70",
                    tint,
                  )}
                >
                  {collab.author.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <Link
                  href={`/profile/${collab.author.id}`}
                  className="block truncate text-sm font-medium hover:text-primary"
                >
                  {collab.author.name}
                </Link>
                <div className="truncate text-xs text-muted-foreground">
                  @{collab.author.username}
                </div>
                {collab.author.industryRole && (
                  <div className="mt-1 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                    {collab.author.industryRole}
                  </div>
                )}
              </div>
            </div>
            {collab.author.bio && (
              <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                {collab.author.bio}
              </p>
            )}
            <Link
              href={`/profile/${collab.author.id}`}
              className="mt-3 block text-center text-xs text-primary hover:underline"
            >
              查看 {collab.author.name} 主页 →
            </Link>
          </section>

          {/* 提示 */}
          <section className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/80">
              <Sparkles className="size-3.5 text-primary" />
              提示
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              先看作品再对接、约定交付物 / 节点 / 验收标准、保留聊天记录。
              如遇争议可在站内举报，平台会协助处理。
            </p>
          </section>

          {/* 时间 */}
          <section className="rounded-2xl border border-border/60 bg-card/40 p-4 text-xs">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/80">
              <Clock className="size-3.5" />
              发布时间
            </div>
            <div className="text-foreground/90">
              {formatRelativeTime(collab.createdAt)}
            </div>
            <div className="mt-0.5 text-muted-foreground">
              {new Date(collab.createdAt).toLocaleString("zh-CN")}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/30 px-3 py-2">
      <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-foreground/95">{value}</div>
    </div>
  );
}
