import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { success, error } from "@/lib/response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await params;
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        owner: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        _count: { select: { posts: true, members: true } },
      },
    });
    if (!channel) throw new NotFoundError("频道");
    return success(channel);
  } catch (err) {
    return error(err);
  }
}
