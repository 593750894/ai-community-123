import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db";

export interface FollowUserSummary {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  industryRole: string | null;
  bio: string | null;
  /** 当前查询者是否已关注此人；未登录或自己时为 false */
  isFollowing: boolean;
}

export interface FollowListResult {
  items: FollowUserSummary[];
  nextCursor: string | null;
  hasMore: boolean;
}

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function clampPageSize(input?: number) {
  return Math.min(MAX_PAGE_SIZE, Math.max(1, input ?? PAGE_SIZE));
}

/**
 * Toggle follow：当前用户关注/取消关注目标用户。
 * 返回最新状态 + 目标用户的最新粉丝数。
 *
 * 防重：依赖 (follower_id, following_id) 唯一约束。
 * 自己关注自己：在调用方拦截（API 层）。
 */
export async function toggleFollow(args: {
  followerId: string;
  followingId: string;
}): Promise<{ following: boolean; followerCount: number; created: boolean }> {
  const { followerId, followingId } = args;

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { id: true },
  });

  try {
    if (existing) {
      await prisma.follow.delete({ where: { id: existing.id } });
      const followerCount = await prisma.follow.count({
        where: { followingId },
      });
      return { following: false, followerCount, created: false };
    }

    await prisma.follow.create({
      data: { followerId, followingId },
      select: { id: true },
    });
    const followerCount = await prisma.follow.count({
      where: { followingId },
    });
    return { following: true, followerCount, created: true };
  } catch (err) {
    // 并发：另一笔请求已经写入。读回真实状态。
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const [stillFollow, followerCount] = await Promise.all([
        prisma.follow.findUnique({
          where: { followerId_followingId: { followerId, followingId } },
          select: { id: true },
        }),
        prisma.follow.count({ where: { followingId } }),
      ]);
      return {
        following: Boolean(stillFollow),
        followerCount,
        created: false,
      };
    }
    throw err;
  }
}

/** 当前用户是否已经关注目标用户 */
export async function isFollowing(args: {
  followerId: string;
  followingId: string;
}): Promise<boolean> {
  if (args.followerId === args.followingId) return false;
  const row = await prisma.follow.findUnique({
    where: {
      followerId_followingId: {
        followerId: args.followerId,
        followingId: args.followingId,
      },
    },
    select: { id: true },
  });
  return Boolean(row);
}

/** 批量查询：当前用户对一组目标用户的关注状态 */
export async function getFollowingMap(args: {
  followerId: string | null;
  targetUserIds: string[];
}): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (!args.followerId || args.targetUserIds.length === 0) return map;

  const rows = await prisma.follow.findMany({
    where: {
      followerId: args.followerId,
      followingId: { in: args.targetUserIds },
    },
    select: { followingId: true },
  });
  for (const r of rows) map.set(r.followingId, true);
  return map;
}

/** 计数：粉丝数 / 关注数 */
export async function countFollowers(userId: string): Promise<number> {
  return prisma.follow.count({ where: { followingId: userId } });
}

export async function countFollowing(userId: string): Promise<number> {
  return prisma.follow.count({ where: { followerId: userId } });
}

/** 一次性返回 followers/following 计数（profile 页用） */
export async function getFollowCounts(userId: string) {
  const [followers, following] = await Promise.all([
    countFollowers(userId),
    countFollowing(userId),
  ]);
  return { followers, following };
}

/** 当前用户关注的所有用户的 id 列表（首页"关注" tab 用） */
export async function getFollowingUserIds(userId: string): Promise<string[]> {
  const rows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  return rows.map((r) => r.followingId);
}

/**
 * 列出某个用户的"粉丝"（关注他的人）。
 * 游标分页：cursor = 上一页最后一条 follow 记录的 id；按 createdAt desc。
 */
export async function listFollowers(args: {
  userId: string;
  viewerId: string | null;
  cursor?: string | null;
  pageSize?: number;
}): Promise<FollowListResult> {
  return listFollowSide({
    direction: "followers",
    subjectId: args.userId,
    viewerId: args.viewerId,
    cursor: args.cursor ?? null,
    pageSize: clampPageSize(args.pageSize),
  });
}

/**
 * 列出某个用户"关注的人"。
 */
export async function listFollowing(args: {
  userId: string;
  viewerId: string | null;
  cursor?: string | null;
  pageSize?: number;
}): Promise<FollowListResult> {
  return listFollowSide({
    direction: "following",
    subjectId: args.userId,
    viewerId: args.viewerId,
    cursor: args.cursor ?? null,
    pageSize: clampPageSize(args.pageSize),
  });
}

async function listFollowSide(args: {
  direction: "followers" | "following";
  subjectId: string;
  viewerId: string | null;
  cursor: string | null;
  pageSize: number;
}): Promise<FollowListResult> {
  const { direction, subjectId, viewerId, cursor, pageSize } = args;

  const where =
    direction === "followers"
      ? { followingId: subjectId }
      : { followerId: subjectId };

  const rows = await prisma.follow.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: pageSize + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      follower:
        direction === "followers"
          ? {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                industryRole: true,
                bio: true,
              },
            }
          : false,
      following:
        direction === "following"
          ? {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                industryRole: true,
                bio: true,
              },
            }
          : false,
    },
  });

  const hasMore = rows.length > pageSize;
  const sliced = hasMore ? rows.slice(0, pageSize) : rows;

  const users = sliced.map((r) =>
    direction === "followers" ? r.follower! : r.following!,
  );

  const followingMap = await getFollowingMap({
    followerId: viewerId,
    targetUserIds: users.map((u) => u.id),
  });

  const items: FollowUserSummary[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    avatar: u.avatar,
    industryRole: u.industryRole,
    bio: u.bio,
    isFollowing: viewerId === u.id ? false : followingMap.get(u.id) ?? false,
  }));

  return {
    items,
    nextCursor: hasMore ? sliced[sliced.length - 1].id : null,
    hasMore,
  };
}
