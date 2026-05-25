import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/**
 * 一次性查出当前登录用户对一组目标的点赞 / 收藏状态。
 * 适用于列表页或详情页同时渲染多个卡片的场景。
 * 未登录或 id 列表为空时直接返回空集合，调用方按集合判断即可。
 */
export type InteractionState = {
  likedPostIds: Set<string>;
  likedWorkIds: Set<string>;
  bookmarkedPostIds: Set<string>;
  bookmarkedWorkIds: Set<string>;
};

const EMPTY: InteractionState = {
  likedPostIds: new Set(),
  likedWorkIds: new Set(),
  bookmarkedPostIds: new Set(),
  bookmarkedWorkIds: new Set(),
};

export async function loadInteractionState(targets: {
  postIds?: string[];
  workIds?: string[];
}): Promise<InteractionState> {
  const session = await getSession();
  if (!session) return EMPTY;
  const userId = session.userId;

  const postIds = targets.postIds && targets.postIds.length > 0 ? targets.postIds : null;
  const workIds = targets.workIds && targets.workIds.length > 0 ? targets.workIds : null;
  if (!postIds && !workIds) return EMPTY;

  const [likes, bookmarks] = await Promise.all([
    prisma.like.findMany({
      where: {
        userId,
        OR: [
          postIds ? { postId: { in: postIds } } : { id: "__never__" },
          workIds ? { workId: { in: workIds } } : { id: "__never__" },
        ],
      },
      select: { postId: true, workId: true },
    }),
    prisma.bookmark.findMany({
      where: {
        userId,
        OR: [
          postIds ? { postId: { in: postIds } } : { id: "__never__" },
          workIds ? { workId: { in: workIds } } : { id: "__never__" },
        ],
      },
      select: { postId: true, workId: true },
    }),
  ]);

  const state: InteractionState = {
    likedPostIds: new Set(),
    likedWorkIds: new Set(),
    bookmarkedPostIds: new Set(),
    bookmarkedWorkIds: new Set(),
  };
  for (const l of likes) {
    if (l.postId) state.likedPostIds.add(l.postId);
    if (l.workId) state.likedWorkIds.add(l.workId);
  }
  for (const b of bookmarks) {
    if (b.postId) state.bookmarkedPostIds.add(b.postId);
    if (b.workId) state.bookmarkedWorkIds.add(b.workId);
  }
  return state;
}
