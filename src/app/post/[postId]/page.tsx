import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  ImageIcon,
  Lock,
  MessageCircle,
  Pin,
  Play,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CommentForm } from "@/components/feed/comment-form";
import { CommentList, type CommentItem } from "@/components/feed/comment-list";
import {
  BookmarkButton,
  LikeButton,
} from "@/components/feed/interaction-buttons";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadInteractionState } from "@/lib/interactions/queries";
import { formatRelativeTime } from "@/lib/utils";
import { postTypeMeta } from "@/lib/post-types";

export const dynamic = "force-dynamic";

async function getPost(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          bio: true,
          industryRole: true,
        },
      },
      channel: {
        select: { id: true, name: true, slug: true, icon: true, color: true },
      },
    },
  });
}

async function getComments(postId: string): Promise<CommentItem[]> {
  const rows = await prisma.comment.findMany({
    where: { postId, parentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: {
        select: { id: true, name: true, username: true, avatar: true },
      },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    content: c.content,
    createdAt: c.createdAt,
    author: c.author,
  }));
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const [post, currentUser] = await Promise.all([
    getPost(postId),
    getCurrentUser(),
  ]);
  if (!post) notFound();

  const [comments, interactions] = await Promise.all([
    getComments(post.id),
    loadInteractionState({ postIds: [post.id] }),
  ]);
  const meta = postTypeMeta(post.type);
  const signedIn = Boolean(currentUser);
  const liked = interactions.likedPostIds.has(post.id);
  const bookmarked = interactions.bookmarkedPostIds.has(post.id);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow={`${post.channel.icon ?? "#"} ${post.channel.name} · ${post.channel.slug}`}
        title={post.title}
        description={`由 ${post.author.name} 于 ${formatRelativeTime(post.createdAt)}发布`}
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/community/${post.channel.id}`} />}
          >
            <ArrowLeft className="size-3.5" />
            返回频道
          </Button>
        }
      />

      <div className="grid gap-6 px-6 py-6 sm:px-8 lg:grid-cols-[1fr_280px]">
        <main className="space-y-6">
          <article className="rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-medium ${meta.tone}`}
              >
                {meta.label}
              </span>
              {post.pinned && (
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <Pin className="size-3" />
                  置顶
                </span>
              )}
              {post.locked && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Lock className="size-3" />
                  已锁定
                </span>
              )}
              <Link
                href={`/community/${post.channel.id}`}
                className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span style={{ color: post.channel.color }}>
                  {post.channel.icon ?? "#"}
                </span>
                <span>{post.channel.name}</span>
              </Link>
            </div>

            <h1 className="mt-3 text-xl font-semibold leading-snug sm:text-2xl">
              {post.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-3 border-y border-border/40 py-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                {post.author.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.author.avatar}
                    alt={post.author.name}
                    className="size-7 rounded-full border border-border/60"
                  />
                ) : (
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-foreground">
                    {post.author.name.slice(0, 1)}
                  </span>
                )}
                <div className="leading-tight">
                  <Link
                    href={`/profile/${post.author.id}`}
                    className="font-medium text-foreground/90 transition-colors hover:text-primary"
                  >
                    {post.author.name}
                  </Link>
                  <div className="text-[11px] text-muted-foreground/80">
                    @{post.author.username}
                    {post.author.industryRole
                      ? ` · ${post.author.industryRole}`
                      : ""}
                  </div>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2 tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3" />
                  {post.views}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="size-3" />
                  {post.commentCount}
                </span>
                <LikeButton
                  target={{ kind: "post", id: post.id }}
                  initialActive={liked}
                  initialCount={post.likeCount}
                  signedIn={signedIn}
                  size="md"
                  variant="solid"
                />
                <BookmarkButton
                  target={{ kind: "post", id: post.id }}
                  initialActive={bookmarked}
                  signedIn={signedIn}
                  size="md"
                  variant="solid"
                />
              </div>
            </div>

            <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/95">
              {post.content}
            </div>

            {(post.videoUrl || post.imageUrl) && (
              <div className="mt-5 space-y-3">
                {post.videoUrl && (
                  <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                    <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      <Play className="size-3" />
                      视频链接
                    </div>
                    <a
                      href={post.videoUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="block truncate text-sm text-primary hover:underline"
                    >
                      {post.videoUrl}
                    </a>
                  </div>
                )}
                {post.imageUrl && (
                  <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                    <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-300">
                      <ImageIcon className="size-3" />
                      图片
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="max-h-[480px] w-full rounded-lg border border-border/60 object-contain"
                    />
                    <a
                      href={post.imageUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 block truncate text-xs text-muted-foreground hover:text-primary"
                    >
                      {post.imageUrl}
                    </a>
                  </div>
                )}
              </div>
            )}
          </article>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-medium">
                <MessageCircle className="size-3.5" />
                评论
                <span className="text-xs text-muted-foreground">
                  共 {post.commentCount}
                </span>
              </h2>
            </div>

            {post.locked ? (
              <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-3 text-sm text-muted-foreground">
                <Lock className="mr-1 inline size-3.5 align-text-bottom" />
                该帖子已被锁定，暂不接受新评论。
              </div>
            ) : (
              <CommentForm
                postId={post.id}
                signedIn={Boolean(currentUser)}
                currentUser={
                  currentUser
                    ? { name: currentUser.name, avatar: currentUser.avatar }
                    : null
                }
              />
            )}

            <CommentList comments={comments} />
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground/80">
              所属频道
            </div>
            <Link
              href={`/community/${post.channel.id}`}
              className="flex items-center gap-2.5"
            >
              <span
                className="flex size-9 items-center justify-center rounded-lg text-lg"
                style={{
                  backgroundColor: `${post.channel.color}20`,
                  color: post.channel.color,
                }}
              >
                {post.channel.icon ?? "#"}
              </span>
              <div>
                <div className="text-sm font-semibold leading-tight">
                  {post.channel.name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {post.channel.slug}
                </div>
              </div>
            </Link>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <div className="mb-3 text-[11px] uppercase tracking-wide text-muted-foreground/80">
              作者
            </div>
            <div className="flex items-center gap-3">
              {post.author.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.author.avatar}
                  alt={post.author.name}
                  className="size-12 rounded-xl border border-border/60"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-sm font-medium">
                  {post.author.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0">
                <Link
                  href={`/profile/${post.author.id}`}
                  className="block truncate text-sm font-medium text-foreground/95 hover:text-primary"
                >
                  {post.author.name}
                </Link>
                <div className="truncate text-xs text-muted-foreground">
                  @{post.author.username}
                </div>
                {post.author.industryRole && (
                  <div className="mt-1 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                    {post.author.industryRole}
                  </div>
                )}
              </div>
            </div>
            {post.author.bio && (
              <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                {post.author.bio}
              </p>
            )}
            <Link
              href={`/profile/${post.author.id}`}
              className="mt-3 block text-center text-xs text-primary hover:underline"
            >
              查看作者主页 →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
