import type { PostType } from "@/generated/prisma/client";

// ---------- Stats ----------
export interface CommunityStats {
  channelCount: number;
  postCount: number;
  creatorCount: number;
  todayPostCount: number;
}

// ---------- Channel ----------
export interface ChannelOverview {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string;
  postCount: number;
  memberCount: number;
  latestPost: {
    id: string;
    title: string;
    createdAt: string;
    authorName: string;
  } | null;
}

// ---------- Post ----------
export interface PostOverview {
  id: string;
  title: string;
  contentPreview: string;
  type: PostType;
  videoUrl: string | null;
  imageUrl: string | null;
  views: number;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  pinned: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
  };
  channel: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string;
  };
}

// ---------- Creator ----------
export interface CreatorOverview {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  bio: string | null;
  industryRole: string | null;
  postCount: number;
  workCount: number;
}

// ---------- Tag ----------
export interface TagOverview {
  tag: string;
  count: number;
}

// ---------- Aggregate response ----------
export interface CommunityOverviewData {
  stats: CommunityStats;
  channels: ChannelOverview[];
  hotChannels: ChannelOverview[];
  latestPosts: PostOverview[];
  hotPosts: PostOverview[];
  activeCreators: CreatorOverview[];
  tags: TagOverview[];
}
