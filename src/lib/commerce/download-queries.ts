import "server-only";

import { prisma } from "@/lib/db";

/**
 * Stage 16.5：admin 查询订单的下载兑换记录。
 *
 * 数据来源：`download_grants` 表（每次成功 redeem 写一行）。
 * 注意：失败的 redeem（token 过期 / 验签失败 / refund 后）**不会**留下 grant 行，
 * 这一类异常仅以 4xx response 出现在 access log / server log 里。本视图覆盖
 * 「真正完成了重定向到卖家裸 URL」的事件。
 */

export interface DownloadGrantRow {
  id: string;
  tokenNonce: string;
  issuedAt: Date;
  expiresAt: Date;
  redeemedAt: Date;
  ip: string | null;
  userAgentHash: string | null;
  user: {
    id: string;
    username: string;
    name: string;
  };
}

export async function listDownloadGrantsForOrder(
  orderNo: string,
  opts?: { limit?: number },
): Promise<DownloadGrantRow[]> {
  // 通过 orderNo 反查 orderId，避免在路由参数里直接暴露 orderId。
  const order = await prisma.order.findUnique({
    where: { orderNo },
    select: { id: true },
  });
  if (!order) return [];
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 200));
  const rows = await prisma.downloadGrant.findMany({
    where: { orderId: order.id },
    orderBy: { redeemedAt: "desc" },
    take: limit,
    select: {
      id: true,
      tokenNonce: true,
      issuedAt: true,
      expiresAt: true,
      redeemedAt: true,
      ip: true,
      userAgentHash: true,
      user: { select: { id: true, username: true, name: true } },
    },
  });
  return rows;
}
