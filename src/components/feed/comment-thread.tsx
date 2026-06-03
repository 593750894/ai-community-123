"use client";

import { useState } from "react";

import type { CommentThread as CommentThreadData } from "@/lib/comments/queries";
import { CommentNodeView } from "@/components/feed/comment-node";

/**
 * 评论树的客户端外壳：持有 "当前打开的 Reply 编辑器 ID"，保证全树同时只有一个。
 */
export function CommentThread({
  thread,
  viewerId,
  viewerIsAdmin,
  likedCommentIds,
}: {
  thread: CommentThreadData;
  viewerId: string | null;
  viewerIsAdmin: boolean;
  /** 当前用户已点赞的评论 id 集合（序列化为数组传入，组件内重组 Set） */
  likedCommentIds: string[];
}) {
  const [openReplyId, setOpenReplyId] = useState<string | null>(null);
  const likedSet = new Set(likedCommentIds);

  if (thread.roots.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-card/20 px-6 py-10 text-center text-sm text-muted-foreground">
        还没有人评论，来抢沙发吧。
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {thread.roots.map((root) => (
        <CommentNodeView
          key={root.id}
          node={root}
          postId={thread.postId}
          viewerId={viewerId}
          viewerIsAdmin={viewerIsAdmin}
          likedCommentIds={likedSet}
          openReplyId={openReplyId}
          setOpenReplyId={setOpenReplyId}
        />
      ))}
    </ul>
  );
}
