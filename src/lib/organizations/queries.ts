import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Stage 11.1：企业相关读操作。所有 server-only，UI 走 Server Components。

const ORG_PUBLIC_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  logo: true,
  website: true,
  isVerified: true,
  industry: true,
  size: true,
  contactEmail: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;

export type OrganizationPublic = Prisma.OrganizationGetPayload<{
  select: typeof ORG_PUBLIC_SELECT;
}>;

export async function listPublicOrganizations(opts: {
  q?: string | null;
  industry?: string | null;
  verifiedOnly?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, opts.pageSize ?? 24));

  const where: Prisma.OrganizationWhereInput = {};
  if (opts.q && opts.q.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q.toLowerCase(), mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  if (opts.industry && opts.industry !== "ALL") {
    where.industry = opts.industry;
  }
  if (opts.verifiedOnly) {
    where.isVerified = true;
  }

  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: { ...ORG_PUBLIC_SELECT, _count: { select: { members: true } } },
      orderBy: [{ isVerified: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.organization.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function getOrganizationBySlug(slug: string) {
  return prisma.organization.findUnique({
    where: { slug },
    select: {
      ...ORG_PUBLIC_SELECT,
      _count: { select: { members: true } },
      owner: { select: { id: true, name: true, username: true, avatar: true } },
    },
  });
}

export async function getOrganizationById(id: string) {
  return prisma.organization.findUnique({
    where: { id },
    select: {
      ...ORG_PUBLIC_SELECT,
      _count: { select: { members: true } },
      owner: { select: { id: true, name: true, username: true, avatar: true } },
    },
  });
}

export async function listMyOrganizations(userId: string) {
  const rows = await prisma.organizationMember.findMany({
    where: { userId },
    select: {
      role: true,
      createdAt: true,
      organization: {
        select: {
          ...ORG_PUBLIC_SELECT,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows;
}

export async function listOrganizationMembers(organizationId: string) {
  return prisma.organizationMember.findMany({
    where: { organizationId },
    select: {
      role: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          bio: true,
          industryRole: true,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
}

export async function getViewerMembership(
  organizationId: string,
  userId: string | null,
) {
  if (!userId) return null;
  return prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true, createdAt: true },
  });
}

export async function listOrganizationInvites(
  organizationId: string,
  status?: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED" | null,
) {
  return prisma.organizationInvite.findMany({
    where: {
      organizationId,
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      role: true,
      status: true,
      message: true,
      createdAt: true,
      respondedAt: true,
      invitee: {
        select: { id: true, name: true, username: true, avatar: true },
      },
      inviter: { select: { id: true, name: true, username: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function listMyInvites(
  userId: string,
  status?: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED" | null,
) {
  return prisma.organizationInvite.findMany({
    where: { inviteeId: userId, ...(status ? { status } : {}) },
    select: {
      id: true,
      role: true,
      status: true,
      message: true,
      createdAt: true,
      respondedAt: true,
      organization: {
        select: {
          id: true,
          slug: true,
          name: true,
          logo: true,
          isVerified: true,
          industry: true,
        },
      },
      inviter: { select: { id: true, name: true, username: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function getPendingInviteCount(userId: string) {
  return prisma.organizationInvite.count({
    where: { inviteeId: userId, status: "PENDING" },
  });
}
