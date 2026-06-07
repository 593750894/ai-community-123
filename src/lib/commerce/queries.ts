import { prisma } from "@/lib/db";

import type {
  WorkflowItemCategory,
  WorkflowItemStatusValue,
} from "./schemas";

/**
 * Commerce 读路径：MembershipPlan 列表 / WorkflowItem 列表 + 详情。
 *
 * 设计：
 * - 公共 list 只暴露 PUBLISHED + SOLD_OUT；DRAFT/ARCHIVED 仅卖家自己可见。
 * - 卖家视角列表覆盖所有 status。
 * - 单页 PDP 走 id（cuid），slug 留给后续 marketing-friendly URL。
 */

export interface WorkflowItemListItem {
  id: string;
  title: string;
  description: string;
  coverUrl: string | null;
  priceCents: number;
  currency: string;
  category: string;
  tags: string[];
  toolStack: string[];
  salesCount: number;
  status: string;
  createdAt: Date;
  seller: {
    id: string;
    username: string;
    name: string;
    avatar: string | null;
  };
}

const LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  coverUrl: true,
  priceCents: true,
  currency: true,
  category: true,
  tags: true,
  toolStack: true,
  salesCount: true,
  status: true,
  createdAt: true,
  seller: {
    select: {
      id: true,
      username: true,
      name: true,
      avatar: true,
    },
  },
  // Stage 11.3：企业归属（null = 个人卖家身份）
  organization: {
    select: {
      id: true,
      slug: true,
      name: true,
      logo: true,
      isVerified: true,
    },
  },
} as const;

// ───────────────────────── MembershipPlan ─────────────────────────

export async function listActiveMembershipPlans() {
  return prisma.membershipPlan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      priceCents: true,
      currency: true,
      cycle: true,
      features: true,
      trialDays: true,
    },
  });
}

export async function getMembershipPlanBySlug(slug: string) {
  return prisma.membershipPlan.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      priceCents: true,
      currency: true,
      cycle: true,
      features: true,
      trialDays: true,
      isActive: true,
    },
  });
}

// ───────────────────────── 公共 marketplace ─────────────────────────

export interface ListPublicWorkflowItemsParams {
  category?: WorkflowItemCategory;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listPublicWorkflowItems(
  params: ListPublicWorkflowItemsParams = {},
) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, params.pageSize ?? 24));
  const skip = (page - 1) * pageSize;

  const where = {
    status: { in: ["PUBLISHED", "SOLD_OUT"] satisfies WorkflowItemStatusValue[] },
    ...(params.category ? { category: params.category } : {}),
    ...(params.q
      ? {
          OR: [
            { title: { contains: params.q, mode: "insensitive" as const } },
            { description: { contains: params.q, mode: "insensitive" as const } },
            { tags: { has: params.q } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.workflowItem.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: pageSize,
      select: LIST_SELECT,
    }),
    prisma.workflowItem.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getPublicWorkflowItem(id: string) {
  return prisma.workflowItem.findFirst({
    where: {
      id,
      status: { in: ["PUBLISHED", "SOLD_OUT"] satisfies WorkflowItemStatusValue[] },
    },
    select: LIST_SELECT,
  });
}

// ───────────────────────── 卖家视角 ─────────────────────────

export async function listMyWorkflowItems(
  sellerId: string,
  params: { status?: WorkflowItemStatusValue; page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, params.pageSize ?? 24));
  const skip = (page - 1) * pageSize;

  const where = {
    sellerId,
    ...(params.status ? { status: params.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.workflowItem.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip,
      take: pageSize,
      select: {
        ...LIST_SELECT,
        downloadUrl: true,
        updatedAt: true,
      },
    }),
    prisma.workflowItem.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getMyWorkflowItem(id: string, sellerId: string) {
  return prisma.workflowItem.findFirst({
    where: { id, sellerId },
    select: {
      ...LIST_SELECT,
      downloadUrl: true,
      updatedAt: true,
    },
  });
}
