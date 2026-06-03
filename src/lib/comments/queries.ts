import { prisma } from "@/lib/db";

/**
 * 评论树查询。
 *
 * 一次 SELECT 把帖子下所有评论拉回来，内存里组装为最多 3 层的树。
 * - 第 4 层及更深的评论被"上提"到第 3 层祖先的 children 数组里（flat），
 *   但保留 parentId 信息，渲染时显示 "@对方 回复："。
 *
 * 这样：
 * - 单次 DB 查询，避免 N+1。
 * - 渲染端递归深度有硬上限，避免 stack overflow / 移动端缩进溢出。
 * - 树形 + flat 混合输出，调用方按 depth 字段决定缩进。
 */

const MAX_DEPTH = 3;

export type CommentThreadAuthor = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
};

export interface CommentNode {
  id: string;
  postId: string;
  parentId: string | null;
  /** 0 = 顶层，1 = 一级回复，2 = 二级回复，3 = 三级及以下都被 flat 到这里 */
  depth: number;
  content: string;
  likeCount: number;
  createdAt: Date;
  author: CommentThreadAuthor;
  /** 当 depth>=3 时该回复的实际父评论作者，渲染时展示 "@xxx 回复："。
   *  在严格意义上的 depth<=2 节点上为 null。*/
  replyingTo: CommentThreadAuthor | null;
  children: CommentNode[];
}

export interface CommentThread {
  postId: string;
  total: number;
  roots: CommentNode[];
}

/**
 * 帖子下所有评论 → CommentThread。
 * total = 数据库中评论总数（用于 UI 展示统计；和 Post.commentCount 应保持一致）。
 */
export async function getCommentThread(
  postId: string,
): Promise<CommentThread> {
  const rows = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      postId: true,
      parentId: true,
      content: true,
      likeCount: true,
      createdAt: true,
      author: {
        select: { id: true, name: true, username: true, avatar: true },
      },
    },
  });

  // 一遍扫：id → node
  const byId = new Map<string, CommentNode>();
  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      postId: r.postId,
      parentId: r.parentId,
      depth: 0,
      content: r.content,
      likeCount: r.likeCount,
      createdAt: r.createdAt,
      author: r.author,
      replyingTo: null,
      children: [],
    });
  }

  // 第二遍：算 depth + 决定挂载点。
  // depth 从根算起：root = 0, reply of root = 1, ...
  // 找到深度 >= MAX_DEPTH 的节点，挂到 MAX_DEPTH-1 那一级的祖先上，并记录 replyingTo。
  const roots: CommentNode[] = [];
  for (const node of byId.values()) {
    if (!node.parentId) {
      node.depth = 0;
      roots.push(node);
      continue;
    }
    // 计算实际深度
    let depth = 0;
    let cursor = node.parentId;
    let lastValidAncestor: CommentNode | null = null;
    while (cursor) {
      const parent = byId.get(cursor);
      if (!parent) break;
      depth += 1;
      // 记下最后一个 depth < MAX_DEPTH 的祖先 —— 它就是 flat 挂载点
      if (depth - 1 < MAX_DEPTH) {
        lastValidAncestor = parent;
      }
      if (!parent.parentId) break;
      cursor = parent.parentId;
      if (depth > 100) break; // 防御：环 / 损坏数据
    }
    node.depth = Math.min(depth, MAX_DEPTH);

    const directParent = byId.get(node.parentId);
    if (!directParent) {
      // 父亲找不到（比如被删了 set null 之后 query 重排），当顶级处理
      node.depth = 0;
      node.parentId = null;
      roots.push(node);
      continue;
    }

    if (depth <= MAX_DEPTH) {
      directParent.children.push(node);
    } else {
      // 超出 MAX_DEPTH：挂到 depth=MAX_DEPTH-1 的祖先（== lastValidAncestor）
      const mountTo = lastValidAncestor ?? directParent;
      node.replyingTo = directParent.author;
      mountTo.children.push(node);
    }
  }

  return { postId, total: rows.length, roots };
}

/**
 * 平铺所有 commentId（用于一次性 loadInteractionState 拿当前用户的点赞集合）。
 */
export function collectCommentIds(thread: CommentThread): string[] {
  const ids: string[] = [];
  const walk = (n: CommentNode) => {
    ids.push(n.id);
    for (const c of n.children) walk(c);
  };
  for (const r of thread.roots) walk(r);
  return ids;
}
