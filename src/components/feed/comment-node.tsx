"use client";

import Link from "next/link";
import { Reply } from "lucide-react";

import { cn, formatRelativeTime } from "@/lib/utils";
import { CommentLikeButton } from "@/components/feed/comment-like-button";
import { DeleteCommentButton } from "@/components/feed/delete-comment-button";
import { ReplyComposer } from "@/components/feed/reply-composer";
import { ReportButton } from "@/components/reports/report-button";
import type { CommentNode as CommentNodeData } from "@/lib/comments/queries";

export interface CommentNodeViewProps {
  node: CommentNodeData;
  postId: string;
  viewerId: string | null;
  viewerIsAdmin: boolean;
  likedCommentIds: Set<string>;
  /** 当前打开了哪条回复编辑器（保证同时只有一条 reply 输入框） */
  openReplyId: string | null;
  setOpenReplyId: (id: string | null) => void;
}

/**
 * 递归渲染单条评论及其 children。
 * - depth 0..2 缩进；depth>=3 节点（已被 query flat）渲染时不再缩进，标题加 "@对方"。
 * - Reply 按钮 / 编辑器互斥（同一 thread 内最多 1 个 composer 打开）。
 */
export function CommentNodeView({
  node,
  postId,
  viewerId,
  viewerIsAdmin,
  likedCommentIds,
  openReplyId,
  setOpenReplyId,
}: CommentNodeViewProps) {
  const isReplyOpen = openReplyId === node.id;
  const isOwner = viewerId !== null && viewerId === node.author.id;
  const canDelete = isOwner || viewerIsAdmin;

  // depth 1/2 的左缩进。depth 0 不缩；depth>=3 已经被 query flat 到 depth-2 容器里，
  // 这里只渲染本节点 —— 缩进交给父容器。
  const indentClass =
    node.depth === 1 ? "sm:ml-6" : node.depth === 2 ? "sm:ml-12" : "";

  return (
    <li
      id={`comment-${node.id}`}
      className={cn(
        "rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4",
        indentClass,
      )}
    >
      <div className="flex items-center gap-2 text-xs">
        {node.author.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.author.avatar}
            alt={node.author.name}
            className="size-6 rounded-full border border-border/60"
          />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
            {node.author.name.slice(0, 1)}
          </span>
        )}
        <Link
          href={`/profile/${node.author.id}`}
          className="font-medium text-foreground/90 transition-colors hover:text-primary"
        >
          {node.author.name}
        </Link>
        <span className="text-muted-foreground/70">@{node.author.username}</span>
        {node.replyingTo && (
          <span className="text-muted-foreground/70">
            回复{" "}
            <Link
              href={`/profile/${node.replyingTo.id}`}
              className="text-primary/80 hover:underline"
            >
              @{node.replyingTo.username}
            </Link>
          </span>
        )}
        <span className="ml-auto tabular-nums text-muted-foreground">
          {formatRelativeTime(node.createdAt)}
        </span>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {node.content}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <CommentLikeButton
          commentId={node.id}
          postId={postId}
          initialActive={likedCommentIds.has(node.id)}
          initialCount={node.likeCount}
          signedIn={viewerId !== null}
        />

        <button
          type="button"
          onClick={() => setOpenReplyId(isReplyOpen ? null : node.id)}
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <Reply className="size-3" />
          {isReplyOpen ? "收起" : "回复"}
        </button>

        {canDelete && (
          <DeleteCommentButton
            commentId={node.id}
            hasReplies={node.children.length > 0}
          />
        )}

        <div className="ml-auto">
          <ReportButton
            targetType="COMMENT"
            targetId={node.id}
            ownerId={node.author.id}
            viewerId={viewerId}
            variant="icon"
            loginNext={`/post/${postId}#comment-${node.id}`}
          />
        </div>
      </div>

      {isReplyOpen && viewerId !== null && (
        <ReplyComposer
          postId={postId}
          parentId={node.id}
          replyingToName={node.author.name}
          onClose={() => setOpenReplyId(null)}
        />
      )}

      {isReplyOpen && viewerId === null && (
        <div className="mt-2 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
          请先{" "}
          <Link
            href={`/auth/login?next=${encodeURIComponent(`/post/${postId}#comment-${node.id}`)}`}
            className="text-primary hover:underline"
          >
            登录
          </Link>{" "}
          再回复评论。
        </div>
      )}

      {node.children.length > 0 && (
        <ul className="mt-3 space-y-3">
          {node.children.map((child) => (
            <CommentNodeView
              key={child.id}
              node={child}
              postId={postId}
              viewerId={viewerId}
              viewerIsAdmin={viewerIsAdmin}
              likedCommentIds={likedCommentIds}
              openReplyId={openReplyId}
              setOpenReplyId={setOpenReplyId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
