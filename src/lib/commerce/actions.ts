import "server-only";

import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

import {
  CreateWorkflowItemSchema,
  UpdateWorkflowItemSchema,
  WorkflowItemStatusActionSchema,
  type CreateWorkflowItemInput,
  type UpdateWorkflowItemInput,
  type WorkflowItemStatusActionInput,
} from "./schemas";

/**
 * 卖家侧 WorkflowItem 写路径。
 *
 * 设计：
 * - DRAFT → PUBLISHED 需要 downloadUrl 必填且 priceCents > 0。
 * - SOLD_OUT 只能由系统在售完时翻转，卖家无法手动改成 SOLD_OUT。
 * - 已有 PAID 订单的商品不可删除（保留交易记录），只能 ARCHIVED 下架。
 */

export async function createWorkflowItem(
  input: CreateWorkflowItemInput,
  sellerId: string,
): Promise<{ id: string }> {
  const data = CreateWorkflowItemSchema.parse(input);
  const created = await prisma.workflowItem.create({
    data: {
      sellerId,
      title: data.title,
      description: data.description,
      coverUrl: data.coverUrl ?? null,
      downloadUrl: data.downloadUrl ?? null,
      priceCents: data.priceCents,
      currency: data.currency ?? "CNY",
      category: data.category,
      tags: data.tags,
      toolStack: data.toolStack,
      status: "DRAFT",
    },
    select: { id: true },
  });
  return created;
}

export async function updateWorkflowItem(
  id: string,
  input: UpdateWorkflowItemInput,
  sellerId: string,
): Promise<void> {
  const data = UpdateWorkflowItemSchema.parse(input);
  const existing = await prisma.workflowItem.findUnique({
    where: { id },
    select: { sellerId: true, status: true },
  });
  if (!existing) throw new NotFoundError("商品");
  if (existing.sellerId !== sellerId) {
    throw new ForbiddenError("只能编辑自己的商品");
  }
  await prisma.workflowItem.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.coverUrl !== undefined ? { coverUrl: data.coverUrl } : {}),
      ...(data.downloadUrl !== undefined ? { downloadUrl: data.downloadUrl } : {}),
      ...(data.priceCents !== undefined ? { priceCents: data.priceCents } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      ...(data.toolStack !== undefined ? { toolStack: data.toolStack } : {}),
    },
  });
}

export async function transitionWorkflowItemStatus(
  id: string,
  input: WorkflowItemStatusActionInput,
  sellerId: string,
): Promise<void> {
  const data = WorkflowItemStatusActionSchema.parse(input);
  const existing = await prisma.workflowItem.findUnique({
    where: { id },
    select: {
      sellerId: true,
      status: true,
      priceCents: true,
      downloadUrl: true,
    },
  });
  if (!existing) throw new NotFoundError("商品");
  if (existing.sellerId !== sellerId) {
    throw new ForbiddenError("只能操作自己的商品");
  }

  // PUBLISHED 必须有 downloadUrl + priceCents > 0
  if (data.status === "PUBLISHED") {
    if (!existing.downloadUrl) {
      throw new ValidationError("上架前必须设置下载链接");
    }
    if (existing.priceCents <= 0) {
      throw new ValidationError("上架前必须设置价格（>0）");
    }
  }

  // 卖家不能手动切到 SOLD_OUT（由系统在售完时切）
  // DRAFT → PUBLISHED → ARCHIVED → PUBLISHED 都允许；SOLD_OUT 由系统管。
  if (existing.status === "SOLD_OUT" && data.status !== "ARCHIVED") {
    throw new ValidationError("已售罄商品仅可下架");
  }

  await prisma.workflowItem.update({
    where: { id },
    data: { status: data.status },
  });
}

export async function deleteWorkflowItem(
  id: string,
  sellerId: string,
): Promise<void> {
  const existing = await prisma.workflowItem.findUnique({
    where: { id },
    select: { sellerId: true, _count: { select: { orders: true } } },
  });
  if (!existing) throw new NotFoundError("商品");
  if (existing.sellerId !== sellerId) {
    throw new ForbiddenError("只能删除自己的商品");
  }
  if (existing._count.orders > 0) {
    throw new ValidationError("已有订单的商品不可删除，请改为下架");
  }
  await prisma.workflowItem.delete({ where: { id } });
}
