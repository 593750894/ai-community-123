import { prisma } from "@/lib/db";
import type { Work } from "@/components/feed/work-card";
import type { PostCardData } from "@/components/feed/post-card";
import type { WorkCategoryValue } from "@/lib/work-categories";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 60;

function clampPageSize(input?: number): number {
  return Math.min(MAX_PAGE_SIZE, Math.max(1, input ?? DEFAULT_PAGE_SIZE));
}

function clampPage(input?: number): number {
  return Math.max(1, Math.floor(input ?? 1));
}

// ──────────────────────────────────────────────────────────────────
// /me Dashboard：用户首页概览的小计数 + 最近条目
// ──────────────────────────────────────────────────────────────────

export interface MeDashboardData {
  counts: {
    works: number;
    posts: number;
    likes: number;
    bookmarks: number;
    followers: number;
    following: number;
  };
  recentWorks: Work[];
  recentPosts: PostCardData[];
}

export async function getMeDashboard(userId: string): Promise<MeDashboardData> {
  const [
    worksCount,
    postsCount,
    likesCount,
    bookmarksCount,
    followers,
    following,
    works,
    posts,
  ] = await Promise.all([
    prisma.work.count({ where: { authorId: userId } }),
    prisma.post.count({ where: { authorId: userId } }),
    prisma.like.count({ where: { userId } }),
    prisma.bookmark.count({ where: { userId } }),
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
    prisma.work.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: {
        author: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
    }),
    prisma.post.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: {
        author: {
          select: { id: true, name: true, username: true, avatar: true, role: true },
        },
        channel: {
          select: { id: true, name: true, slug: true, icon: true, color: true },
        },
      },
    }),
  ]);

  return {
    counts: {
      works: worksCount,
      posts: postsCount,
      likes: likesCount,
      bookmarks: bookmarksCount,
      followers,
      following,
    },
    recentWorks: works.map(toWorkCard),
    recentPosts: posts.map(toPostCard),
  };
}

// ──────────────────────────────────────────────────────────────────
// /me/works
// ──────────────────────────────────────────────────────────────────

export interface MeWorksPage {
  items: Work[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export async function getMyWorks(args: {
  userId: string;
  page?: number;
  pageSize?: number;
}): Promise<MeWorksPage> {
  const page = clampPage(args.page);
  const pageSize = clampPageSize(args.pageSize);
  const skip = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    prisma.work.findMany({
      where: { authorId: args.userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        author: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
    }),
    prisma.work.count({ where: { authorId: args.userId } }),
  ]);

  return {
    items: rows.map(toWorkCard),
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}

// ──────────────────────────────────────────────────────────────────
// /me/likes：用户点赞的 Post + Work 混合列表
// ──────────────────────────────────────────────────────────────────

export type MyEngagementItem =
  | { kind: "post"; engagedAt: Date; post: PostCardData }
  | { kind: "work"; engagedAt: Date; work: Work };

export interface MyEngagementPage {
  items: MyEngagementItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export async function getMyLikes(args: {
  userId: string;
  page?: number;
  pageSize?: number;
}): Promise<MyEngagementPage> {
  const page = clampPage(args.page);
  const pageSize = clampPageSize(args.pageSize);
  const skip = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    prisma.like.findMany({
      where: {
        userId: args.userId,
        OR: [{ postId: { not: null } }, { workId: { not: null } }],
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                role: true,
              },
            },
            channel: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
                color: true,
              },
            },
          },
        },
        work: {
          include: {
            author: {
              select: { id: true, name: true, username: true, avatar: true },
            },
          },
        },
      },
    }),
    prisma.like.count({
      where: {
        userId: args.userId,
        OR: [{ postId: { not: null } }, { workId: { not: null } }],
      },
    }),
  ]);

  const items: MyEngagementItem[] = [];
  for (const r of rows) {
    if (r.post) {
      items.push({ kind: "post", engagedAt: r.createdAt, post: toPostCard(r.post) });
    } else if (r.work) {
      items.push({ kind: "work", engagedAt: r.createdAt, work: toWorkCard(r.work) });
    }
  }

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}

// ──────────────────────────────────────────────────────────────────
// /me/bookmarks：用户收藏的 Post + Work 混合列表
// ──────────────────────────────────────────────────────────────────

export async function getMyBookmarks(args: {
  userId: string;
  page?: number;
  pageSize?: number;
}): Promise<MyEngagementPage> {
  const page = clampPage(args.page);
  const pageSize = clampPageSize(args.pageSize);
  const skip = (page - 1) * pageSize;

  const [rows, total] = await Promise.all([
    prisma.bookmark.findMany({
      where: { userId: args.userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                role: true,
              },
            },
            channel: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
                color: true,
              },
            },
          },
        },
        work: {
          include: {
            author: {
              select: { id: true, name: true, username: true, avatar: true },
            },
          },
        },
      },
    }),
    prisma.bookmark.count({ where: { userId: args.userId } }),
  ]);

  const items: MyEngagementItem[] = [];
  for (const r of rows) {
    if (r.post) {
      items.push({ kind: "post", engagedAt: r.createdAt, post: toPostCard(r.post) });
    } else if (r.work) {
      items.push({ kind: "work", engagedAt: r.createdAt, work: toWorkCard(r.work) });
    }
  }

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: skip + rows.length < total,
  };
}

// ──────────────────────────────────────────────────────────────────
// 内部映射
// ──────────────────────────────────────────────────────────────────

type WorkRow = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  category: string;
  description: string | null;
  tools: string[];
  likeCount: number;
  bookmarkCount: number;
  durationSec: number | null;
  ratio: string | null;
  model: string;
  author: { id: string; name: string; username: string; avatar: string | null };
};

function toWorkCard(w: WorkRow): Work {
  return {
    id: w.id,
    title: w.title,
    thumbnailUrl: w.thumbnailUrl,
    category: w.category as WorkCategoryValue,
    description: w.description,
    tools: w.tools,
    likeCount: w.likeCount,
    bookmarkCount: w.bookmarkCount,
    durationSec: w.durationSec,
    ratio: (w.ratio as Work["ratio"]) ?? "16:9",
    author: w.author.name,
    authorId: w.author.id,
  };
}

type PostRow = {
  id: string;
  title: string;
  content: string;
  type: PostCardData["type"];
  videoUrl: string | null;
  imageUrl: string | null;
  views: number;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  pinned: boolean;
  createdAt: Date;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    role: "USER" | "MOD" | "ADMIN";
  };
  channel: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string;
  };
};

function toPostCard(p: PostRow): PostCardData {
  return {
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
  };
}
