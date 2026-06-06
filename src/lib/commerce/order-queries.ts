import "server-only";

import { Prisma, prisma } from "@/lib/db";
import type { OrderStatus, OrderType, PaymentMethod } from "@/generated/prisma/client";

import type { OrderStatusValue, OrderTypeValue, PaymentMethodValue } from "./schemas";

/**
 * Stage 10.4：订单读路径。
 *
 * 两个视角：
 *   - listMyOrders(userId)：买家只能看到自己的订单。
 *   - listOrdersForAdmin()：admin 看全量，可按状态 / 类型 / 渠道 / 时间 / 订单号 / 买家
 *     筛选。表格列表展示，PageHeader 顶上提示当前筛选。
 *
 * 排序：默认 createdAt desc；分页 offset（与 /admin/audit-logs / /admin/reports 一致）。
 *
 * 注意：返回结构尽量精简，避免把 callback_payload / metadata 等大字段带到列表 — 详情页再单独取。
 */

export interface OrderListRow {
  id: string;
  orderNo: string;
  status: OrderStatus;
  type: OrderType;
  amountCents: number;
  currency: string;
  paymentMethod: PaymentMethod | null;
  refundCents: number;
  refundedAt: Date | null;
  paidAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  buyer: {
    id: string;
    name: string;
    username: string;
  };
  plan: { id: string; name: string; slug: string } | null;
  workflowItem: {
    id: string;
    title: string;
    seller: { id: string; name: string; username: string };
  } | null;
}

const LIST_INCLUDE = {
  user: {
    select: { id: true, name: true, username: true },
  },
  plan: {
    select: { id: true, name: true, slug: true },
  },
  workflowItem: {
    select: {
      id: true,
      title: true,
      seller: { select: { id: true, name: true, username: true } },
    },
  },
} satisfies Prisma.OrderInclude;

type OrderRow = Prisma.OrderGetPayload<{ include: typeof LIST_INCLUDE }>;

function shapeRow(o: OrderRow): OrderListRow {
  return {
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    type: o.type,
    amountCents: o.amountCents,
    currency: o.currency,
    paymentMethod: o.paymentMethod,
    refundCents: o.refundCents,
    refundedAt: o.refundedAt,
    paidAt: o.paidAt,
    expiresAt: o.expiresAt,
    createdAt: o.createdAt,
    buyer: o.user,
    plan: o.plan,
    workflowItem: o.workflowItem,
  };
}

// ────────────────────────── 用户视角 ──────────────────────────

export interface ListMyOrdersArgs {
  userId: string;
  status?: OrderStatusValue;
  page: number;
  pageSize: number;
}

export interface ListMyOrdersResult {
  items: OrderListRow[];
  total: number;
}

export async function listMyOrders(
  args: ListMyOrdersArgs,
): Promise<ListMyOrdersResult> {
  const where: Prisma.OrderWhereInput = {
    userId: args.userId,
    ...(args.status ? { status: args.status } : {}),
  };
  const skip = (Math.max(1, args.page) - 1) * args.pageSize;
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: LIST_INCLUDE,
      skip,
      take: args.pageSize,
    }),
    prisma.order.count({ where }),
  ]);
  return { items: rows.map(shapeRow), total };
}

// ────────────────────────── Admin 视角 ──────────────────────────

export interface ListAdminOrdersArgs {
  status?: OrderStatusValue;
  type?: OrderTypeValue;
  paymentMethod?: PaymentMethodValue;
  /** 模糊查买家用户名 / 昵称 / orderNo 精确匹配 */
  q?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export interface ListAdminOrdersResult {
  items: OrderListRow[];
  total: number;
}

export async function listOrdersForAdmin(
  args: ListAdminOrdersArgs,
): Promise<ListAdminOrdersResult> {
  const where: Prisma.OrderWhereInput = {};
  if (args.status) where.status = args.status;
  if (args.type) where.type = args.type;
  if (args.paymentMethod) where.paymentMethod = args.paymentMethod;
  if (args.from || args.to) {
    where.createdAt = {};
    if (args.from) where.createdAt.gte = args.from;
    if (args.to) where.createdAt.lte = args.to;
  }
  if (args.q) {
    // orderNo 是 22 字符；用户输入完整的话精确匹配，否则按 name/username 模糊。
    where.OR = [
      { orderNo: args.q },
      {
        user: {
          OR: [
            { username: { contains: args.q, mode: "insensitive" } },
            { name: { contains: args.q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }
  const skip = (Math.max(1, args.page) - 1) * args.pageSize;
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: LIST_INCLUDE,
      skip,
      take: args.pageSize,
    }),
    prisma.order.count({ where }),
  ]);
  return { items: rows.map(shapeRow), total };
}

// ────────────────────────── 单个订单（admin/buyer）──────────────────

export interface OrderDetailForAdmin extends OrderListRow {
  refunds: Array<{
    id: string;
    amountCents: number;
    reason: string | null;
    status: string;
    providerError: string | null;
    createdAt: Date;
    finishedAt: Date | null;
    createdBy: { id: string; name: string; username: string } | null;
  }>;
}

export async function getOrderForAdmin(
  orderNo: string,
): Promise<OrderDetailForAdmin | null> {
  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: {
      ...LIST_INCLUDE,
      refunds: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, username: true } },
        },
      },
    },
  });
  if (!order) return null;
  return {
    ...shapeRow(order),
    refunds: order.refunds.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      reason: r.reason,
      status: r.status,
      providerError: r.providerError,
      createdAt: r.createdAt,
      finishedAt: r.finishedAt,
      createdBy: r.createdBy,
    })),
  };
}

/** 买家视角：含 refunds 摘要，不暴露 providerError / providerResponse 等 admin 字段。 */
export interface OrderDetailForBuyer extends OrderListRow {
  refunds: Array<{
    id: string;
    amountCents: number;
    reason: string | null;
    status: string;
    createdAt: Date;
  }>;
}

export async function getOrderForBuyer(
  orderNo: string,
  buyerId: string,
): Promise<OrderDetailForBuyer | null> {
  const order = await prisma.order.findUnique({
    where: { orderNo },
    include: {
      ...LIST_INCLUDE,
      refunds: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amountCents: true,
          reason: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });
  if (!order || order.userId !== buyerId) return null;
  return {
    ...shapeRow(order),
    refunds: order.refunds,
  };
}
