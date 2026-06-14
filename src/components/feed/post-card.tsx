import Link from "next/link";
import { Eye, ImageIcon, MessageCircle, Pin, Play, Shield, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn, formatRelativeTime } from "@/lib/utils";
import { postTypeMeta, type PostTypeValue } from "@/lib/post-types";
import {
  BookmarkButton,
  LikeButton,
} from "@/components/feed/interaction-buttons";
import { ReportButton } from "@/components/reports/report-button";
import {
  OrgAttributionBadge,
  type OrgAttribution,
} from "@/components/publish/org-attribution-badge";

const ROLE_META: Record<string, { label: string; icon: typeof Shield; className: string } | undefined> = {
  MOD: { label: "版主", icon: Shield, className: "text-blue-600 dark:text-blue-400" },
  ADMIN: { label: "管理员", icon: ShieldCheck, className: "text-amber-600 dark:text-amber-400" },
};

export type PostCardData = {
  id: string;
  title: string;
  content: string;
  type: PostTypeValue;
  videoUrl: string | null;
  imageUrl: string | null;
  views: number;
  likeCount: number;
  commentCount: number;
  bookmarkCount?: number;
  pinned: boolean;
  createdAt: Date | string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    role?: "USER" | "MOD" | "ADMIN";
  };
  channel?: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string;
  };
  organization?: OrgAttribution | null;
};

export function PostCard({
  post,
  showChannel = false,
  signedIn = false,
  liked = false,
  bookmarked = false,
  viewerId = null,
}: {
  post: PostCardData;
  showChannel?: boolean;
  signedIn?: boolean;
  liked?: boolean;
  bookmarked?: boolean;
  viewerId?: string | null;
}) {
  const meta = postTypeMeta(post.type);
  const hasMedia = Boolean(post.videoUrl || post.imageUrl);

  return (
    <article
      className={cn(
        "group surface-card overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 sm:p-5",
        post.pinned && "border-tag-amber-fg/40 bg-tag-amber-bg/5 hover:border-tag-amber-fg/60",
      )}
    >
      {/* Top row: type badge + meta */}
      <div className="flex items-center gap-2 text-[11px]">
        <Badge variant="default">{meta.label}</Badge>
        {post.pinned && (
          <Badge variant="warning" className="gap-1">
            <Pin className="size-3" />
            置顶
          </Badge>
        )}
        {hasMedia && (
          <div className="flex items-center gap-1.5">
            {post.videoUrl && <Play className="size-3.5 text-muted-foreground" />}
            {post.imageUrl && <ImageIcon className="size-3.5 text-muted-foreground" />}
          </div>
        )}
        {showChannel && post.channel && (
          <Link
            href={`/community/${post.channel.id}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {post.channel.icon && <span>{post.channel.icon}</span>}
            <span>{post.channel.name}</span>
          </Link>
        )}
        <span className="ml-auto text-muted-foreground/70 tabular-nums">
          {formatRelativeTime(post.createdAt)}
        </span>
      </div>

      {/* Title */}
      <Link
        href={`/post/${post.id}`}
        className="mt-2.5 block text-[15px] font-semibold leading-snug text-foreground/95 transition-colors group-hover:text-primary"
      >
        {post.title}
      </Link>

      {/* Content preview */}
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground/80">
        {post.content}
      </p>

      {/* Author + interaction footer */}
      <div className="mt-3.5 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {post.author.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.author.avatar}
              alt={post.author.name}
              className="size-6 rounded-full border border-border"
            />
          ) : (
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
              {post.author.name.slice(0, 1)}
            </span>
          )}
          <Link
            href={`/profile/${post.author.id}`}
            className="font-medium text-foreground/90 transition-colors hover:text-primary"
          >
            {post.author.name}
          </Link>
          {post.author.role && ROLE_META[post.author.role] && (() => {
            const rm = ROLE_META[post.author.role!]!;
            const RoleIcon = rm.icon;
            return (
              <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium", rm.className)}>
                <RoleIcon className="size-3" />
                {rm.label}
              </span>
            );
          })()}
          {post.organization && <OrgAttributionBadge org={post.organization} size="xs" />}
        </div>
        <div className="ml-auto flex items-center gap-2.5 tabular-nums">
          <span className="inline-flex items-center gap-1 text-muted-foreground/60">
            <Eye className="size-3" />
            {post.views}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground/60">
            <MessageCircle className="size-3" />
            {post.commentCount}
          </span>
          <LikeButton
            target={{ kind: "post", id: post.id }}
            initialActive={liked}
            initialCount={post.likeCount}
            signedIn={signedIn}
          />
          <BookmarkButton
            target={{ kind: "post", id: post.id }}
            initialActive={bookmarked}
            initialCount={post.bookmarkCount}
            showCount={post.bookmarkCount != null}
            signedIn={signedIn}
          />
          <ReportButton
            targetType="POST"
            targetId={post.id}
            ownerId={post.author.id}
            viewerId={viewerId}
            variant="icon"
            loginNext={`/post/${post.id}`}
          />
        </div>
      </div>
    </article>
  );
}
