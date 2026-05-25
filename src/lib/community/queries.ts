import { prisma } from "@/lib/db";

export async function getCommunityStats() {
  const [channelCount, postCount, userCount] = await Promise.all([
    prisma.channel.count(),
    prisma.post.count(),
    prisma.user.count(),
  ]);
  return { channelCount, postCount, userCount };
}

export async function getPopularChannels(limit = 8) {
  return prisma.channel.findMany({
    orderBy: { members: { _count: "desc" } },
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

export async function getLatestPosts(limit = 6) {
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

export async function getHotPosts(limit = 5, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return prisma.post.findMany({
    where: { createdAt: { gte: since } },
    orderBy: [{ likeCount: "desc" }, { views: "desc" }],
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

export async function getPopularTags(limit = 12) {
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

  return Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}
