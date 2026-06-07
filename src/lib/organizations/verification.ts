import type { Prisma } from "@/generated/prisma/client";
import { createAuditLog } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import {
  notifyOrgVerificationApproved,
  notifyOrgVerificationRejected,
} from "@/lib/notifications/emit";

import {
  ReviewVerificationSchema,
  SubmitVerificationSchema,
  type OrgVerificationStatusValue,
  type ReviewVerificationInput,
  type SubmitVerificationInput,
} from "./schemas";

// Stage 11.2：企业认证业务层。设计要点：
//   - OWNER / ADMIN 可提交申请；状态 NONE / REJECTED 可走 submit；PENDING 期间禁止重复提交。
//   - APPROVED 期间也允许「重新提交」（企业资料变更后重新审核），状态回 PENDING；
//     提交期间 isVerified 不主动撤销 — 已认证企业仍然展示 ✔，由 admin 在新审核里决定是否保留。
//   - admin 审核动作 (APPROVE / REJECT) 写 AuditLog + 推通知（链接含驳回原因）。
//   - cancelVerification：仅当 PENDING 状态可由 OWNER/ADMIN 撤回（状态回 REJECTED 不合适，回 NONE 也不行，因为
//     上次审核记录会丢；为了 MVP 简单化，撤回直接回 NONE 并清空提交字段。）

interface OrgRoleRow {
  ownerId: string;
  membership: { role: "OWNER" | "ADMIN" | "MEMBER" } | null;
}

async function loadOrgForVerification(orgId: string, userId: string): Promise<OrgRoleRow & { id: string; slug: string; name: string; verificationStatus: OrgVerificationStatusValue; isVerified: boolean }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerId: true,
      isVerified: true,
      verificationStatus: true,
    },
  });
  if (!org) throw new NotFoundError("企业");
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
    select: { role: true },
  });
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    isVerified: org.isVerified,
    verificationStatus: org.verificationStatus as OrgVerificationStatusValue,
    ownerId: org.ownerId,
    membership: membership ? { role: membership.role } : null,
  };
}

/** 卖家提交 / 重新提交企业认证。状态：NONE | REJECTED | APPROVED → PENDING。 */
export async function submitOrgVerification(args: {
  organizationId: string;
  actorId: string;
  input: SubmitVerificationInput;
}) {
  const parsed = SubmitVerificationSchema.parse(args.input);
  const org = await loadOrgForVerification(args.organizationId, args.actorId);

  if (!org.membership || (org.membership.role !== "OWNER" && org.membership.role !== "ADMIN")) {
    throw new ForbiddenError("仅企业 OWNER / ADMIN 可提交认证");
  }
  if (org.verificationStatus === "PENDING") {
    throw new ConflictError("已有待审核的认证申请");
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: {
      verificationStatus: "PENDING",
      verificationName: parsed.name,
      verificationRegNo: parsed.regNo,
      verificationRep: parsed.rep,
      verificationLicenseUrl: parsed.licenseUrl,
      verificationContact: parsed.contact,
      verificationNote: parsed.note,
      verificationReviewNote: null,
      verificationSubmittedAt: new Date(),
      verificationReviewedAt: null,
      verificationReviewedBy: null,
    },
  });
}

/** 卖家撤回 PENDING 申请。状态：PENDING → NONE，清空提交字段。 */
export async function cancelOrgVerification(args: {
  organizationId: string;
  actorId: string;
}) {
  const org = await loadOrgForVerification(args.organizationId, args.actorId);
  if (!org.membership || (org.membership.role !== "OWNER" && org.membership.role !== "ADMIN")) {
    throw new ForbiddenError("仅企业 OWNER / ADMIN 可撤回认证");
  }
  if (org.verificationStatus !== "PENDING") {
    throw new ValidationError("仅待审核的申请可撤回");
  }
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      verificationStatus: "NONE",
      verificationName: null,
      verificationRegNo: null,
      verificationRep: null,
      verificationLicenseUrl: null,
      verificationContact: null,
      verificationNote: null,
      verificationSubmittedAt: null,
    },
  });
}

/** Admin 审核认证申请。decision=APPROVE 时同时翻 isVerified=true；REJECT 时不动 isVerified。 */
export async function reviewOrgVerification(args: {
  organizationId: string;
  adminId: string;
  input: ReviewVerificationInput;
}) {
  const parsed = ReviewVerificationSchema.parse(args.input);
  const org = await prisma.organization.findUnique({
    where: { id: args.organizationId },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerId: true,
      isVerified: true,
      verificationStatus: true,
      verificationSubmittedAt: true,
    },
  });
  if (!org) throw new NotFoundError("企业");
  if (org.verificationStatus !== "PENDING") {
    throw new ValidationError("仅待审核的申请可处理");
  }

  const approve = parsed.decision === "APPROVE";
  const nextStatus: OrgVerificationStatusValue = approve ? "APPROVED" : "REJECTED";

  // updateMany WHERE status='PENDING' 兜并发：两位 admin 同时点审核，第二位返回 count=0，抛冲突。
  const upd = await prisma.organization.updateMany({
    where: { id: org.id, verificationStatus: "PENDING" },
    data: {
      verificationStatus: nextStatus,
      verificationReviewedAt: new Date(),
      verificationReviewedBy: args.adminId,
      verificationReviewNote: parsed.note || null,
      ...(approve ? { isVerified: true } : {}),
    },
  });
  if (upd.count === 0) {
    throw new ConflictError("申请状态已变更，请刷新");
  }

  // AuditLog + 通知 owner（fire-and-forget；失败不阻塞）
  await createAuditLog({
    adminId: args.adminId,
    action: approve ? "ORG_VERIFICATION_APPROVE" : "ORG_VERIFICATION_REJECT",
    targetType: "Organization",
    targetId: org.id,
    metadata: {
      slug: org.slug,
      name: org.name,
      note: parsed.note || null,
      isVerifiedBefore: org.isVerified,
      isVerifiedAfter: approve ? true : org.isVerified,
    },
  });

  if (approve) {
    void notifyOrgVerificationApproved({
      recipientId: org.ownerId,
      organizationName: org.name,
      organizationSlug: org.slug,
      reviewNote: parsed.note || null,
    });
  } else {
    void notifyOrgVerificationRejected({
      recipientId: org.ownerId,
      organizationName: org.name,
      organizationSlug: org.slug,
      reviewNote: parsed.note || "未提供具体原因",
    });
  }
}

// ── 读层 ──────────────────────────────────────────────────────────

const VERIFICATION_SELECT = {
  id: true,
  slug: true,
  name: true,
  logo: true,
  isVerified: true,
  verificationStatus: true,
  verificationName: true,
  verificationRegNo: true,
  verificationRep: true,
  verificationLicenseUrl: true,
  verificationContact: true,
  verificationNote: true,
  verificationReviewNote: true,
  verificationSubmittedAt: true,
  verificationReviewedAt: true,
  verificationReviewedBy: true,
} satisfies Prisma.OrganizationSelect;

export type OrgVerificationView = Prisma.OrganizationGetPayload<{
  select: typeof VERIFICATION_SELECT;
}>;

export async function getOrgVerification(organizationId: string): Promise<OrgVerificationView | null> {
  const row = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: VERIFICATION_SELECT,
  });
  return row;
}

export interface AdminPendingFilters {
  status?: OrgVerificationStatusValue | null;
  q?: string | null;
  page?: number;
  pageSize?: number;
}

export async function listAdminVerifications(filters: AdminPendingFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));

  const where: Prisma.OrganizationWhereInput = {};
  // 默认只看 PENDING；status="ALL" 由 API 传 null
  const status = filters.status ?? "PENDING";
  if (status !== null) where.verificationStatus = status;

  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q.toLowerCase(), mode: "insensitive" } },
      { verificationName: { contains: q, mode: "insensitive" } },
      { verificationRegNo: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total, pendingTotal] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        ...VERIFICATION_SELECT,
        owner: { select: { id: true, name: true, username: true } },
        verificationAdmin: { select: { id: true, name: true, username: true } },
      },
      orderBy: [
        { verificationStatus: "asc" },
        { verificationSubmittedAt: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.organization.count({ where }),
    prisma.organization.count({
      where: { verificationStatus: "PENDING" },
    }),
  ]);

  return { items, total, pendingTotal, page, pageSize };
}
