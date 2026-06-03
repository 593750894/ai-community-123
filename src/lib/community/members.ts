import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db";

/**
 * 当前用户是否已加入该频道。
 */
export async function isChannelMember(args: {
  channelId: string;
  userId: string;
}): Promise<boolean> {
  const row = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: { channelId: args.channelId, userId: args.userId },
    },
    select: { channelId: true },
  });
  return Boolean(row);
}

interface ToggleResult {
  member: boolean;
  memberCount: number;
  created: boolean;
}

async function runToggle(args: {
  channelId: string;
  userId: string;
}): Promise<ToggleResult> {
  const { channelId, userId } = args;
  // 把 findUnique → delete/create → count 全部放进同一个 tx，
  // 保证返回的 memberCount 反映的就是本次写入后的状态。
  return prisma.$transaction(async (tx) => {
    const existing = await tx.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
      select: { channelId: true },
    });
    if (existing) {
      await tx.channelMember.delete({
        where: { channelId_userId: { channelId, userId } },
      });
      const memberCount = await tx.channelMember.count({ where: { channelId } });
      return { member: false, memberCount, created: false };
    }
    await tx.channelMember.create({
      data: { channelId, userId },
      select: { channelId: true },
    });
    const memberCount = await tx.channelMember.count({ where: { channelId } });
    return { member: true, memberCount, created: true };
  });
}

/**
 * 加入/退出频道。返回最新状态 + 最新成员数。
 *
 * 防重：依赖 (channelId, userId) 复合主键 + 事务隔离。
 * 并发：
 *   - P2002（create 时唯一冲突）= 另一笔请求已加入，retry 一次会进 delete 分支；
 *   - P2025（delete 时记录不存在）= 另一笔请求已退出，retry 一次会进 create 分支。
 * 其他 Prisma 错误（FK 失败 P2003、tx 冲突 P2034 等）必须冒泡，
 * 否则会把失败的请求伪装成 200 OK。
 */
export async function toggleChannelMembership(args: {
  channelId: string;
  userId: string;
}): Promise<ToggleResult> {
  try {
    return await runToggle(args);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2002" || err.code === "P2025")
    ) {
      return runToggle(args);
    }
    throw err;
  }
}
