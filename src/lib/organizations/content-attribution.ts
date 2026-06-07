import "server-only";

import { prisma } from "@/lib/db";
import { ForbiddenError, ValidationError } from "@/lib/errors";

/**
 * Stage 11.3：企业内容归属
 *
 * 设计原则：
 * - 「以企业身份发布」是用户主动选择，需在 form 上明示选择身份；后端再次校验
 *   操作者是否还在该企业内、企业是否仍存在，避免 UI 缓存导致越权。
 * - `authorId` / `sellerId` 始终保留为真实操作者：通知、审计、销售款都按个人记录。
 *   `organizationId` 只是「品牌归属」展示标识。
 * - 当前 MVP 所有 OrganizationMember 角色均可以企业身份发布。后续如需限制
 *   （例如「只有 ADMIN 才能上架商品」），改这里一个白名单即可。
 *
 * 入口：
 * - `resolveOrgAttribution(userId, raw)` — 表单/请求参数 -> 真正落库的 organizationId | null
 * - `listMyPostableOrganizations(userId)` — UI 上的「身份选择器」候选列表
 */

const ORG_ATTRIBUTABLE_ROLES = new Set(["OWNER", "ADMIN", "MEMBER"]);

/**
 * 校验用户对该企业是否有「以企业身份发布」的权限。
 * - 必须仍是该企业的成员
 * - 角色在白名单内（当前 = OWNER/ADMIN/MEMBER 全集）
 *
 * 注意：这是写入前的「创建时」检查，不是存储层约束。一旦内容落库 organizationId=X，
 * 不会再被自动撤销 —— 因此成员被移除 / 主动退出时，必须同步调用
 * `revokeOrgAttributionForUser(userId, orgId)` 把历史内容卸下品牌。
 */
export async function assertOrgPostingPermission(
  userId: string,
  organizationId: string,
): Promise<void> {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });
  if (!membership) {
    throw new ForbiddenError("你不是该企业成员，无法以企业身份发布");
  }
  if (!ORG_ATTRIBUTABLE_ROLES.has(membership.role)) {
    throw new ForbiddenError("当前角色无权以企业身份发布");
  }
}

/**
 * 解析表单 / API 入参的 organizationId：
 * - 空 / "" / "PERSONAL" / null / undefined => null （= 个人身份）
 * - 非空字符串 => 校验是否为成员；通过则返回该 id，未通过抛 ForbiddenError
 *
 * 调用方应直接把返回值作为 prisma data.organizationId 写入。
 */
export async function resolveOrgAttribution(
  userId: string,
  raw: string | null | undefined,
): Promise<string | null> {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === "PERSONAL") return null;
  // CUID 长度 25；这里只做轻量格式护栏，真正存在性由 FK + 成员关系查询兜底
  if (trimmed.length > 64 || /[\s]/.test(trimmed)) {
    throw new ValidationError("企业身份参数格式非法");
  }
  await assertOrgPostingPermission(userId, trimmed);
  return trimmed;
}

/**
 * UI 身份选择器候选列表。按 OWNER → ADMIN → MEMBER 排序，便于默认聚焦在
 * 用户「最常用」的企业上。
 */
export type PostableOrganization = {
  id: string;
  slug: string;
  name: string;
  logo: string | null;
  isVerified: boolean;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

export async function listMyPostableOrganizations(
  userId: string,
): Promise<PostableOrganization[]> {
  const rows = await prisma.organizationMember.findMany({
    where: { userId },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          slug: true,
          name: true,
          logo: true,
          isVerified: true,
        },
      },
    },
  });
  return rows
    .filter((r) => ORG_ATTRIBUTABLE_ROLES.has(r.role))
    .map((r) => ({
      id: r.organization.id,
      slug: r.organization.slug,
      name: r.organization.name,
      logo: r.organization.logo,
      isVerified: r.organization.isVerified,
      role: r.role,
    }))
    .sort((a, b) => {
      const order = (role: string) =>
        role === "OWNER" ? 0 : role === "ADMIN" ? 1 : 2;
      const diff = order(a.role) - order(b.role);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
}

/**
 * 企业聚合 feed：把 post / work / collaboration / workflowItem 四类内容
 * 按 createdAt desc 合并，给 `/organizations/[slug]/feed` 使用。
 *
 * MVP：每类取最近 limit 条，内存里合并后再裁到 limit；对个位数千的企业够用。
 * 后续若量上来，可加 cursor + per-table cursor 或独立物化视图。
 */
export type OrgFeedItem =
  | {
      kind: "post";
      id: string;
      title: string;
      createdAt: Date;
      author: { id: string; name: string; username: string; avatar: string | null };
      excerpt: string;
    }
  | {
      kind: "work";
      id: string;
      title: string;
      createdAt: Date;
      author: { id: string; name: string; username: string; avatar: string | null };
      thumbnailUrl: string | null;
    }
  | {
      kind: "collab";
      id: string;
      title: string;
      createdAt: Date;
      author: { id: string; name: string; username: string; avatar: string | null };
      status: string;
    }
  | {
      kind: "workflow";
      id: string;
      title: string;
      createdAt: Date;
      author: { id: string; name: string; username: string; avatar: string | null };
      coverUrl: string | null;
      priceCents: number;
      status: string;
    };

export async function listOrganizationFeed(
  organizationId: string,
  limit = 30,
): Promise<OrgFeedItem[]> {
  const cap = Math.max(1, Math.min(100, limit));
  const [posts, works, collabs, items] = await Promise.all([
    prisma.post.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: cap,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        author: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
    }),
    prisma.work.findMany({
      where: { organizationId, isPublic: true },
      orderBy: { createdAt: "desc" },
      take: cap,
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        createdAt: true,
        author: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
    }),
    prisma.collaboration.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: cap,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        author: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
    }),
    prisma.workflowItem.findMany({
      where: { organizationId, status: { in: ["PUBLISHED", "SOLD_OUT"] } },
      orderBy: { createdAt: "desc" },
      take: cap,
      select: {
        id: true,
        title: true,
        coverUrl: true,
        priceCents: true,
        status: true,
        createdAt: true,
        seller: {
          select: { id: true, name: true, username: true, avatar: true },
        },
      },
    }),
  ]);

  const merged: OrgFeedItem[] = [
    ...posts.map<OrgFeedItem>((p) => ({
      kind: "post",
      id: p.id,
      title: p.title,
      createdAt: p.createdAt,
      author: p.author,
      excerpt: p.content.slice(0, 140),
    })),
    ...works.map<OrgFeedItem>((w) => ({
      kind: "work",
      id: w.id,
      title: w.title,
      createdAt: w.createdAt,
      author: w.author,
      thumbnailUrl: w.thumbnailUrl,
    })),
    ...collabs.map<OrgFeedItem>((c) => ({
      kind: "collab",
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      author: c.author,
      status: c.status,
    })),
    ...items.map<OrgFeedItem>((it) => ({
      kind: "workflow",
      id: it.id,
      title: it.title,
      createdAt: it.createdAt,
      author: it.seller,
      coverUrl: it.coverUrl,
      priceCents: it.priceCents,
      status: it.status,
    })),
  ];

  merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return merged.slice(0, cap);
}

/**
 * Stage 11.3 安全：成员被踢出 / 主动退出企业时，把这位用户在该企业名下的全部内容
 * 卸下品牌（organizationId → null）。作者 / 卖家身份保留，只移除企业归属展示。
 *
 * 注意：不动 sellerId / authorId / Payout / 通知。仅清空 4 张内容表的 organizationId。
 * - posts.authorId = userId
 * - works.authorId = userId
 * - collaborations.authorId = userId
 * - workflowItems.sellerId = userId
 * 都额外用 organizationId = X 限定，避免误清其它企业归属（同一人可能身兼多个企业）。
 */
export async function revokeOrgAttributionForUser(
  userId: string,
  organizationId: string,
): Promise<{
  posts: number;
  works: number;
  collaborations: number;
  workflowItems: number;
}> {
  const [posts, works, collaborations, workflowItems] = await prisma.$transaction([
    prisma.post.updateMany({
      where: { authorId: userId, organizationId },
      data: { organizationId: null },
    }),
    prisma.work.updateMany({
      where: { authorId: userId, organizationId },
      data: { organizationId: null },
    }),
    prisma.collaboration.updateMany({
      where: { authorId: userId, organizationId },
      data: { organizationId: null },
    }),
    prisma.workflowItem.updateMany({
      where: { sellerId: userId, organizationId },
      data: { organizationId: null },
    }),
  ]);
  return {
    posts: posts.count,
    works: works.count,
    collaborations: collaborations.count,
    workflowItems: workflowItems.count,
  };
}

/**
 * 计数：用在公开企业详情页 stats（与 `_count.members` 并列）。
 */
export async function getOrganizationContentCounts(organizationId: string) {
  const [posts, works, collaborations, workflowItems] = await Promise.all([
    prisma.post.count({ where: { organizationId } }),
    prisma.work.count({ where: { organizationId, isPublic: true } }),
    prisma.collaboration.count({ where: { organizationId } }),
    prisma.workflowItem.count({
      where: { organizationId, status: { in: ["PUBLISHED", "SOLD_OUT"] } },
    }),
  ]);
  return { posts, works, collaborations, workflowItems };
}
