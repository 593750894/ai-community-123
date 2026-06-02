import { prisma } from "@/lib/db";

export type SearchType = "post" | "work" | "user" | "channel" | "tool";

export const SEARCH_TYPES: SearchType[] = [
  "post",
  "work",
  "user",
  "channel",
  "tool",
];

export interface PostSearchHit {
  type: "post";
  id: string;
  title: string;
  snippet: string;
  href: string;
  imageUrl: string | null;
  createdAt: string;
  channel: { id: string; name: string; slug: string };
  author: { id: string; name: string; username: string; avatar: string | null };
  likeCount: number;
  commentCount: number;
}

export interface WorkSearchHit {
  type: "work";
  id: string;
  title: string;
  snippet: string;
  href: string;
  thumbnailUrl: string | null;
  createdAt: string;
  author: { id: string; name: string; username: string; avatar: string | null };
  likeCount: number;
  category: string;
}

export interface UserSearchHit {
  type: "user";
  id: string;
  title: string;
  username: string;
  snippet: string;
  href: string;
  avatar: string | null;
  industryRole: string | null;
}

export interface ChannelSearchHit {
  type: "channel";
  id: string;
  title: string;
  slug: string;
  snippet: string;
  href: string;
  icon: string | null;
  color: string;
  postCount: number;
  memberCount: number;
}

export interface ToolSearchHit {
  type: "tool";
  id: string;
  title: string;
  snippet: string;
  href: string;
  logoUrl: string | null;
  category: string;
  pricing: string;
}

export type SearchHit =
  | PostSearchHit
  | WorkSearchHit
  | UserSearchHit
  | ChannelSearchHit
  | ToolSearchHit;

export interface SearchResult {
  query: string;
  totals: Record<SearchType, number>;
  hits: SearchHit[];
}

const DEFAULT_PER_TYPE_LIMIT = 10;
const MAX_PER_TYPE_LIMIT = 30;

function snippet(text: string | null | undefined, max = 140): string {
  if (!text) return "";
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(0, max) + "…" : trimmed;
}

/**
 * 跨域搜索：在指定 types 内对 q 做大小写不敏感的子串匹配。
 * 当 q 为空时直接返回空结果。
 * 单次最多返回 5 * limit 条（每类 limit 条）。
 */
export async function searchAll(
  q: string,
  opts: { types?: SearchType[]; limit?: number } = {},
): Promise<SearchResult> {
  const query = q.trim();
  const types = (opts.types && opts.types.length > 0
    ? opts.types
    : SEARCH_TYPES) as SearchType[];
  const limit = Math.min(
    MAX_PER_TYPE_LIMIT,
    Math.max(1, opts.limit ?? DEFAULT_PER_TYPE_LIMIT),
  );

  const empty: SearchResult = {
    query,
    totals: { post: 0, work: 0, user: 0, channel: 0, tool: 0 },
    hits: [],
  };
  if (!query) return empty;

  const contains = { contains: query, mode: "insensitive" as const };

  const [
    postRows,
    postCount,
    workRows,
    workCount,
    userRows,
    userCount,
    channelRows,
    channelCount,
    toolRows,
    toolCount,
  ] = await Promise.all([
    types.includes("post")
      ? prisma.post.findMany({
          where: { OR: [{ title: contains }, { content: contains }] },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            title: true,
            content: true,
            imageUrl: true,
            createdAt: true,
            likeCount: true,
            commentCount: true,
            channel: { select: { id: true, name: true, slug: true } },
            author: {
              select: { id: true, name: true, username: true, avatar: true },
            },
          },
        })
      : [],
    types.includes("post")
      ? prisma.post.count({
          where: { OR: [{ title: contains }, { content: contains }] },
        })
      : 0,
    types.includes("work")
      ? prisma.work.findMany({
          where: {
            isPublic: true,
            OR: [{ title: contains }, { description: contains }],
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            title: true,
            description: true,
            thumbnailUrl: true,
            createdAt: true,
            likeCount: true,
            category: true,
            author: {
              select: { id: true, name: true, username: true, avatar: true },
            },
          },
        })
      : [],
    types.includes("work")
      ? prisma.work.count({
          where: {
            isPublic: true,
            OR: [{ title: contains }, { description: contains }],
          },
        })
      : 0,
    types.includes("user")
      ? prisma.user.findMany({
          where: {
            status: "ACTIVE",
            OR: [{ name: contains }, { username: contains }, { bio: contains }],
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            bio: true,
            industryRole: true,
          },
        })
      : [],
    types.includes("user")
      ? prisma.user.count({
          where: {
            status: "ACTIVE",
            OR: [{ name: contains }, { username: contains }, { bio: contains }],
          },
        })
      : 0,
    types.includes("channel")
      ? prisma.channel.findMany({
          where: {
            OR: [{ name: contains }, { description: contains }],
          },
          take: limit,
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            icon: true,
            color: true,
            _count: { select: { posts: true, members: true } },
          },
        })
      : [],
    types.includes("channel")
      ? prisma.channel.count({
          where: { OR: [{ name: contains }, { description: contains }] },
        })
      : 0,
    types.includes("tool")
      ? prisma.tool.findMany({
          where: {
            OR: [{ name: contains }, { description: contains }],
          },
          take: limit,
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            logoUrl: true,
            category: true,
            pricing: true,
          },
        })
      : [],
    types.includes("tool")
      ? prisma.tool.count({
          where: { OR: [{ name: contains }, { description: contains }] },
        })
      : 0,
  ]);

  const postHits: PostSearchHit[] = postRows.map((p) => ({
    type: "post",
    id: p.id,
    title: p.title,
    snippet: snippet(p.content),
    href: `/post/${p.id}`,
    imageUrl: p.imageUrl,
    createdAt: p.createdAt.toISOString(),
    channel: p.channel,
    author: p.author,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
  }));

  const workHits: WorkSearchHit[] = workRows.map((w) => ({
    type: "work",
    id: w.id,
    title: w.title,
    snippet: snippet(w.description),
    href: `/showcase/${w.id}`,
    thumbnailUrl: w.thumbnailUrl,
    createdAt: w.createdAt.toISOString(),
    author: w.author,
    likeCount: w.likeCount,
    category: w.category,
  }));

  const userHits: UserSearchHit[] = userRows.map((u) => ({
    type: "user",
    id: u.id,
    title: u.name,
    username: u.username,
    snippet: snippet(u.bio),
    href: `/profile/${u.id}`,
    avatar: u.avatar,
    industryRole: u.industryRole,
  }));

  const channelHits: ChannelSearchHit[] = channelRows.map((c) => ({
    type: "channel",
    id: c.id,
    title: c.name,
    slug: c.slug,
    snippet: snippet(c.description),
    href: `/community/${c.slug}`,
    icon: c.icon,
    color: c.color,
    postCount: c._count.posts,
    memberCount: c._count.members,
  }));

  const toolHits: ToolSearchHit[] = toolRows.map((t) => ({
    type: "tool",
    id: t.id,
    title: t.name,
    snippet: snippet(t.description),
    href: `/tools#${t.slug}`,
    logoUrl: t.logoUrl,
    category: t.category,
    pricing: t.pricing,
  }));

  const hits: SearchHit[] = [
    ...postHits,
    ...workHits,
    ...userHits,
    ...channelHits,
    ...toolHits,
  ];

  return {
    query,
    totals: {
      post: postCount,
      work: workCount,
      user: userCount,
      channel: channelCount,
      tool: toolCount,
    },
    hits,
  };
}
