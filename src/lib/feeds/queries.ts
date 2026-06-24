import { prisma } from "@/lib/db";
import type { WorkCategory, WorkModel } from "@/generated/prisma/client";

const RECOMMEND_WINDOW_DAYS = 7;
const DEFAULT_LIMIT = 24;
const SCAN_LIMIT = 200;

const WORK_AUTHOR_SELECT = {
  id: true,
  name: true,
  username: true,
  avatar: true,
} as const;

const WORK_BASE_SELECT = {
  id: true,
  title: true,
  description: true,
  thumbnailUrl: true,
  category: true,
  tools: true,
  durationSec: true,
  ratio: true,
  views: true,
  likeCount: true,
  bookmarkCount: true,
  createdAt: true,
  author: { select: WORK_AUTHOR_SELECT },
  organization: {
    select: { id: true, slug: true, name: true, logo: true, isVerified: true },
  },
} as const;

export type FeedWorkRow = {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  category: string;
  tools: string[];
  durationSec: number | null;
  ratio: string | null;
  views: number;
  likeCount: number;
  bookmarkCount: number;
  createdAt: Date;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
  };
  organization: {
    id: string;
    slug: string;
    name: string;
    logo: string | null;
    isVerified: boolean;
  } | null;
};

/**
 * 推荐：最近 7 天内公开作品，按 (点赞×2 + 收藏×3 + 浏览) 加权。
 * 7 天内没数据时退回到全量按权重排序，避免冷启动空白。
 */
export async function getRecommendedWorks(
  limit: number = DEFAULT_LIMIT,
): Promise<FeedWorkRow[]> {
  const since = new Date(Date.now() - RECOMMEND_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  let pool = await prisma.work.findMany({
    where: { isPublic: true, deletedAt: null, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: SCAN_LIMIT,
    select: WORK_BASE_SELECT,
  });

  if (pool.length === 0) {
    pool = await prisma.work.findMany({
      where: { isPublic: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: SCAN_LIMIT,
      select: WORK_BASE_SELECT,
    });
  }

  return pool
    .map((w) => ({
      row: w,
      score: w.likeCount * 2 + w.bookmarkCount * 3 + w.views,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.row.createdAt.getTime() - a.row.createdAt.getTime();
    })
    .slice(0, limit)
    .map((x) => x.row);
}

/** 最新：纯 createdAt desc */
export async function getLatestWorks(
  limit: number = DEFAULT_LIMIT,
): Promise<FeedWorkRow[]> {
  return prisma.work.findMany({
    where: { isPublic: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: WORK_BASE_SELECT,
  });
}

/** 按 WorkCategory 枚举筛选 */
export async function getWorksByCategory(
  category: WorkCategory,
  limit: number = DEFAULT_LIMIT,
): Promise<FeedWorkRow[]> {
  return prisma.work.findMany({
    where: { isPublic: true, deletedAt: null, category },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: WORK_BASE_SELECT,
  });
}

/** 按 WorkModel 枚举筛选（"Seedance 2.0" tab 用） */
export async function getWorksByModel(
  model: WorkModel,
  limit: number = DEFAULT_LIMIT,
): Promise<FeedWorkRow[]> {
  return prisma.work.findMany({
    where: { isPublic: true, deletedAt: null, model },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: WORK_BASE_SELECT,
  });
}
