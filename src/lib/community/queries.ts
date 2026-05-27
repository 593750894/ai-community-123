import { prisma } from "@/lib/db";
import type {
  CommunityOverviewData,
  CommunityStats,
  ChannelOverview,
  ChannelDetail,
  ChannelPostsQuery,
  ChannelPostsResult,
  ChannelStats,
  ChannelHotPost,
  PostOverview,
  CreatorOverview,
  TagOverview,
} from "@/types/community";
import type { PostType } from "@/generated/prisma/client";
import { CHANNEL_CATEGORIES } from "./channel-categories";

// ---------- Shared select shapes ----------

const postSelect = {
  id: true,
  title: true,
  content: true,
  type: true,
  videoUrl: true,
  imageUrl: true,
  views: true,
  likeCount: true,
  commentCount: true,
  bookmarkCount: true,
  pinned: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: { id: true, name: true, username: true, avatar: true, role: true },
  },
  channel: {
    select: { id: true, name: true, slug: true, icon: true, color: true },
  },
} as const;

// ---------- Community overview queries ----------

export async function getCommunityStats(): Promise<CommunityStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [channelCount, postCount, creatorCount, todayPostCount] =
    await Promise.all([
      prisma.channel.count(),
      prisma.post.count(),
      prisma.user.count(),
      prisma.post.count({ where: { createdAt: { gte: todayStart } } }),
    ]);
  return { channelCount, postCount, creatorCount, todayPostCount };
}

export async function getHotChannels(limit = 6) {
  return prisma.channel.findMany({
    orderBy: { posts: { _count: "desc" } },
    take: limit,
    include: {
      _count: { select: { posts: true, members: true } },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          title: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });
}

export async function getLatestPosts(limit = 8) {
  return prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: postSelect,
  });
}

export async function getHotPosts(limit = 6, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const posts = await prisma.post.findMany({
    where: { createdAt: { gte: since } },
    take: 50,
    select: postSelect,
  });

  return posts
    .sort((a, b) => {
      const scoreA = a.likeCount + a.commentCount * 2 + a.bookmarkCount;
      const scoreB = b.likeCount + b.commentCount * 2 + b.bookmarkCount;
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

export async function getActiveCreators(limit = 6) {
  return prisma.user.findMany({
    orderBy: { posts: { _count: "desc" } },
    take: limit,
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      bio: true,
      industryRole: true,
      _count: { select: { posts: true, works: true } },
    },
  });
}

const DEFAULT_TAGS: TagOverview[] = [
  { tag: "Seedance 2.0", count: 0 },
  { tag: "AI短剧", count: 0 },
  { tag: "数字人", count: 0 },
  { tag: "ComfyUI", count: 0 },
  { tag: "Kling", count: 0 },
  { tag: "教程", count: 0 },
  { tag: "工作流", count: 0 },
  { tag: "工具评测", count: 0 },
  { tag: "接单", count: 0 },
  { tag: "招募", count: 0 },
];

export async function getPopularTags(limit = 12): Promise<TagOverview[]> {
  const collabs = await prisma.collaboration.findMany({
    where: { tags: { isEmpty: false } },
    select: { tags: true },
  });

  const tagCount = new Map<string, number>();
  for (const c of collabs) {
    for (const tag of c.tags) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }

  const dbTags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));

  return dbTags.length > 0 ? dbTags : DEFAULT_TAGS.slice(0, limit);
}

export async function getAllChannels(): Promise<ChannelOverview[]> {
  const rows = await prisma.channel.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { posts: true, members: true } },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          title: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((ch) => ({
    id: ch.id,
    slug: ch.slug,
    name: ch.name,
    description: ch.description,
    icon: ch.icon,
    color: ch.color,
    postCount: ch._count.posts,
    memberCount: ch._count.members,
    latestPost: ch.posts[0]
      ? {
          id: ch.posts[0].id,
          title: ch.posts[0].title,
          createdAt: ch.posts[0].createdAt.toISOString(),
          authorName: ch.posts[0].author.name,
        }
      : null,
  }));
}

function toPostOverview(post: Awaited<ReturnType<typeof getLatestPosts>>[number]): PostOverview {
  return {
    id: post.id,
    title: post.title,
    contentPreview: post.content.length > 120 ? post.content.slice(0, 120) + "…" : post.content,
    type: post.type,
    videoUrl: post.videoUrl,
    imageUrl: post.imageUrl,
    views: post.views,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    bookmarkCount: post.bookmarkCount,
    pinned: post.pinned,
    createdAt: (post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt)).toISOString(),
    updatedAt: ("updatedAt" in post && post.updatedAt)
      ? (post.updatedAt instanceof Date ? post.updatedAt : new Date(post.updatedAt as string)).toISOString()
      : (post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt)).toISOString(),
    author: post.author as PostOverview["author"],
    channel: post.channel!,
  };
}

function toCreatorOverview(user: Awaited<ReturnType<typeof getActiveCreators>>[number]): CreatorOverview {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    bio: user.bio,
    industryRole: user.industryRole,
    postCount: user._count.posts,
    workCount: user._count.works,
  };
}

function toChannelOverview(ch: Awaited<ReturnType<typeof getHotChannels>>[number]): ChannelOverview {
  return {
    id: ch.id,
    slug: ch.slug,
    name: ch.name,
    description: ch.description,
    icon: ch.icon,
    color: ch.color,
    postCount: ch._count.posts,
    memberCount: ch._count.members,
    latestPost: ch.posts[0]
      ? {
          id: ch.posts[0].id,
          title: ch.posts[0].title,
          createdAt: ch.posts[0].createdAt.toISOString(),
          authorName: ch.posts[0].author.name,
        }
      : null,
  };
}

// ---------- Channel detail queries ----------

function getChannelCategory(slug: string): string | null {
  for (const cat of CHANNEL_CATEGORIES) {
    if (cat.channels.some((ch) => ch.slug === slug)) {
      return cat.label;
    }
  }
  return null;
}

export async function getChannelDetail(
  idOrSlug: string,
): Promise<ChannelDetail | null> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const ch = await prisma.channel.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      _count: { select: { posts: true, members: true } },
      owner: { select: { id: true, name: true, username: true } },
    },
  });
  if (!ch) return null;

  const todayPostCount = await prisma.post.count({
    where: { channelId: ch.id, createdAt: { gte: todayStart } },
  });

  return {
    id: ch.id,
    slug: ch.slug,
    name: ch.name,
    description: ch.description,
    icon: ch.icon,
    banner: ch.banner,
    color: ch.color,
    category: getChannelCategory(ch.slug),
    createdAt: ch.createdAt.toISOString(),
    owner: ch.owner,
    postCount: ch._count.posts,
    memberCount: ch._count.members,
    todayPostCount,
  };
}

function buildPostOrderBy(sort: ChannelPostsQuery["sort"]) {
  switch (sort) {
    case "hot":
      return [{ likeCount: "desc" as const }, { commentCount: "desc" as const }];
    case "mostCommented":
      return [{ commentCount: "desc" as const }, { createdAt: "desc" as const }];
    case "mostLiked":
      return [{ likeCount: "desc" as const }, { createdAt: "desc" as const }];
    default:
      return [{ pinned: "desc" as const }, { createdAt: "desc" as const }];
  }
}

export async function getChannelPosts(
  channelId: string,
  opts: ChannelPostsQuery = {},
): Promise<ChannelPostsResult> {
  const { type, sort = "latest", search, page = 1, limit = 20 } = opts;

  const where: Record<string, unknown> = { channelId };
  if (type) where.type = type as PostType;
  if (search) where.title = { contains: search, mode: "insensitive" };

  const [total, rows] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy: buildPostOrderBy(sort),
      skip: (page - 1) * limit,
      take: limit,
      select: postSelect,
    }),
  ]);

  return {
    posts: rows.map(toPostOverview),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getChannelHotPosts(
  channelId: string,
  limit = 5,
  days = 7,
): Promise<PostOverview[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const posts = await prisma.post.findMany({
    where: { channelId, createdAt: { gte: since } },
    take: 50,
    select: postSelect,
  });

  return posts
    .sort((a, b) => {
      const scoreA = a.likeCount + a.commentCount * 2 + a.bookmarkCount;
      const scoreB = b.likeCount + b.commentCount * 2 + b.bookmarkCount;
      return scoreB - scoreA;
    })
    .slice(0, limit)
    .map(toPostOverview);
}

export async function getChannelHotPostsLite(
  channelId: string,
  limit = 5,
  days = 7,
): Promise<ChannelHotPost[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const posts = await prisma.post.findMany({
    where: { channelId, createdAt: { gte: since } },
    take: 50,
    select: {
      id: true,
      title: true,
      likeCount: true,
      commentCount: true,
      bookmarkCount: true,
    },
  });

  return posts
    .sort((a, b) => {
      const scoreA = a.likeCount + a.commentCount * 2 + a.bookmarkCount;
      const scoreB = b.likeCount + b.commentCount * 2 + b.bookmarkCount;
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

export async function getChannelStats(channelId: string): Promise<ChannelStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [postCount, todayPostCount, creatorCount, hotPostCount] =
    await Promise.all([
      prisma.post.count({ where: { channelId } }),
      prisma.post.count({ where: { channelId, createdAt: { gte: todayStart } } }),
      prisma.post
        .groupBy({ by: ["authorId"], where: { channelId } })
        .then((rows) => rows.length),
      prisma.post.count({
        where: {
          channelId,
          createdAt: { gte: weekAgo },
          OR: [{ likeCount: { gte: 3 } }, { commentCount: { gte: 2 } }],
        },
      }),
    ]);

  return { postCount, todayPostCount, creatorCount, hotPostCount };
}

export async function getCommunityOverview(): Promise<CommunityOverviewData> {
  const [stats, channels, hotChannels, latestPosts, hotPosts, creators, tags] =
    await Promise.all([
      getCommunityStats(),
      getAllChannels(),
      getHotChannels(),
      getLatestPosts(),
      getHotPosts(),
      getActiveCreators(),
      getPopularTags(),
    ]);

  return {
    stats,
    channels,
    hotChannels: hotChannels.map(toChannelOverview),
    latestPosts: latestPosts.map(toPostOverview),
    hotPosts: hotPosts.map(toPostOverview),
    activeCreators: creators.map(toCreatorOverview),
    tags,
  };
}
