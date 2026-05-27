import { NotFoundError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import {
  getChannelDetail,
  getChannelStats,
  getChannelHotPostsLite,
} from "@/lib/community/queries";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await params;
    const channel = await getChannelDetail(channelId);
    if (!channel) throw new NotFoundError("频道");

    const [stats, hotPosts] = await Promise.all([
      getChannelStats(channel.id),
      getChannelHotPostsLite(channel.id),
    ]);

    return success({ channel, stats, hotPosts });
  } catch (err) {
    return error(err);
  }
}
