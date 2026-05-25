import { prisma } from "@/lib/db";
import type {
  CommunityOverviewData,
  CommunityStats,
  ChannelOverview,
  PostOverview,
  CreatorOverview,
  TagOverview,
} from "@/types/community";

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
    select: {
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
      author: {
        select: { id: true, name: true, username: true, avatar: true },
      },
      channel: {
        select: { id: true, name: true, slug: true, icon: true, color: true },
      },
    },
  });
}

export async function getHotPosts(limit = 6, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const posts = await prisma.post.findMany({
    where: { createdAt: { gte: since } },
    take: 50,
    select: {
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
      author: {
        select: { id: true, name: true, username: true, avatar: true },
      },
      channel: {
        select: { id: true, name: true, slug: true, icon: true, color: true },
      },
    },
  });

  return posts
    .sort((a, b) => {
      const scoreA = a.likeCount + a.commentCount + a.bookmarkCount;
      const scoreB = b.likeCount + b.commentCount + b.bookmarkCount;
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
  { tag: "AI视频", count: 0 },
  { tag: "Seedance", count: 0 },
  { tag: "AI漫剧", count: 0 },
  { tag: "AI短剧", count: 0 },
  { tag: "数字人", count: 0 },
  { tag: "ComfyUI", count: 0 },
  { tag: "提示词", count: 0 },
  { tag: "Runway", count: 0 },
  { tag: "电商广告", count: 0 },
  { tag: "教程", count: 0 },
  { tag: "合作", count: 0 },
  { tag: "工作流", count: 0 },
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
    author: post.author,
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
