import "server-only";

import { prisma } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  assertOrgPostingPermission,
  resolveOrgAttribution,
} from "@/lib/organizations/content-attribution";

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
  const resolvedOrgId = await resolveOrgAttribution(sellerId, data.organizationId);
  const created = await prisma.workflowItem.create({
    data: {
      sellerId,
      organizationId: resolvedOrgId,
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
  // Stage 11.3：允许在编辑时切换企业归属（含「切回个人」= organizationId=null）。
  // 只有当请求里显式带了 organizationId 字段（非 undefined）才参与更新。
  let attributionPatch: { organizationId: string | null } | Record<string, never> = {};
  if (data.organizationId !== undefined) {
    const resolved = await resolveOrgAttribution(sellerId, data.organizationId);
    attributionPatch = { organizationId: resolved };
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
      ...attributionPatch,
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
      organizationId: true,
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
    // Stage 11.3 安全：草稿可能在卖家以企业身份预存后、被踢出企业再上架的情况下
    // 把内容公开打上企业品牌。这里在上架闸口再校验一次组织归属是否仍有效。
    if (existing.organizationId) {
      await assertOrgPostingPermission(sellerId, existing.organizationId);
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
