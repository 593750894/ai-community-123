import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { toggleChannelMembership } from "@/lib/community/members";
import { createRateLimiter } from "@/lib/rate-limit";

// 形如 cuid (clxxx...) 或 slug (a-z0-9-)；上限 64 char 避免 10kB 字符串进 Prisma OR。
const ID_OR_SLUG_RE = /^[a-zA-Z0-9_-]{1,64}$/;

// 单用户每分钟最多 10 次 toggle，足够正常使用，足以挡掉脚本 abuse。
const limiter = createRateLimiter({
  limit: 10,
  windowMs: 60 * 1000,
  name: "频道加入/退出",
});

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const user = await requireAuth();
    await requireActiveUser(user);
    const { channelId: idOrSlug } = await params;

    if (!ID_OR_SLUG_RE.test(idOrSlug)) {
      throw new ValidationError("频道标识不合法");
    }

    limiter.check(user.id);

    const channel = await prisma.channel.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      select: { id: true },
    });
    if (!channel) throw new NotFoundError("频道");

    const result = await toggleChannelMembership({
      channelId: channel.id,
      userId: user.id,
    });

    return success({
      member: result.member,
      memberCount: result.memberCount,
    });
  } catch (err) {
    return error(err);
  }
}
