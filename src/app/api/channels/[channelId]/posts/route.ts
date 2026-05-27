import { NotFoundError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { getChannelDetail, getChannelPosts } from "@/lib/community/queries";
import type { ChannelPostSort } from "@/types/community";

const VALID_SORTS = new Set<ChannelPostSort>(["latest", "hot", "mostCommented", "mostLiked"]);
const MAX_PAGE_SIZE = 50;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await params;
    const channel = await getChannelDetail(channelId);
    if (!channel) throw new NotFoundError("频道");

    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(url.searchParams.get("pageSize")) || 20),
    );
    const type = url.searchParams.get("type") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const sortParam = url.searchParams.get("sort") || "latest";
    const sort: ChannelPostSort = VALID_SORTS.has(sortParam as ChannelPostSort)
      ? (sortParam as ChannelPostSort)
      : "latest";

    const result = await getChannelPosts(channel.id, {
      type,
      sort,
      search,
      page,
      limit,
    });

    return success({
      channel: { id: channel.id, name: channel.name, slug: channel.slug },
      posts: result.posts,
      pagination: {
        page: result.page,
        pageSize: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasMore: result.page < result.totalPages,
      },
    });
  } catch (err) {
    return error(err);
  }
}
