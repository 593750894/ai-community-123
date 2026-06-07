import { Prisma } from "@/generated/prisma/client";
import type { OrgRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  notifyOrgInvite,
  notifyOrgInviteResponse,
  notifyOrgMemberRemoved,
} from "@/lib/notifications/emit";
import {
  CreateOrganizationSchema,
  InviteMemberSchema,
  UpdateMemberRoleSchema,
  UpdateOrganizationSchema,
  type CreateOrganizationInput,
  type InviteMemberInput,
} from "./schemas";

// Stage 11.1：企业创建 / 编辑 / 成员管理 / 邀请。所有调用方需先校验登录态。

/** 创建企业 + 把创建者写为 OWNER。同事务内防 slug 撞库。 */
export async function createOrganization(args: {
  ownerId: string;
  input: CreateOrganizationInput;
}) {
  const parsed = CreateOrganizationSchema.parse(args.input);
  try {
    return await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          slug: parsed.slug,
          name: parsed.name,
          description: parsed.description,
          logo: parsed.logo,
          website: parsed.website,
          industry: parsed.industry ?? null,
          size: parsed.size ?? null,
          contactEmail: parsed.contactEmail,
          ownerId: args.ownerId,
        },
        select: { id: true, slug: true, name: true },
      });
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: args.ownerId,
          role: "OWNER",
        },
      });
      return org;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError("该 slug 已被占用，请换一个");
    }
    throw err;
  }
}

/** 编辑企业基础信息。仅 OWNER / ADMIN 可改；isVerified 不在此动作。 */
export async function updateOrganization(args: {
  organizationId: string;
  actorId: string;
  input: Record<string, unknown>;
}) {
  const parsed = UpdateOrganizationSchema.parse(args.input);
  await assertOrgRole(args.organizationId, args.actorId, ["OWNER", "ADMIN"]);
  return prisma.organization.update({
    where: { id: args.organizationId },
    data: {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.logo !== undefined ? { logo: parsed.logo } : {}),
      ...(parsed.website !== undefined ? { website: parsed.website } : {}),
      ...(parsed.industry !== undefined ? { industry: parsed.industry } : {}),
      ...(parsed.size !== undefined ? { size: parsed.size } : {}),
      ...(parsed.contactEmail !== undefined ? { contactEmail: parsed.contactEmail } : {}),
    },
    select: { id: true, slug: true },
  });
}

/** 解散企业。仅 OWNER 可；级联删除 members + invites（FK CASCADE）。 */
export async function deleteOrganization(args: {
  organizationId: string;
  actorId: string;
}) {
  const org = await prisma.organization.findUnique({
    where: { id: args.organizationId },
    select: { id: true, ownerId: true },
  });
  if (!org) throw new NotFoundError("企业");
  if (org.ownerId !== args.actorId) {
    throw new ForbiddenError("仅企业所有者可解散");
  }
  await prisma.organization.delete({ where: { id: args.organizationId } });
}

/** 邀请用户加入企业。OWNER / ADMIN 可邀请。 */
export async function inviteMember(args: {
  organizationId: string;
  actorId: string;
  input: InviteMemberInput;
}) {
  const parsed = InviteMemberSchema.parse(args.input);
  await assertOrgRole(args.organizationId, args.actorId, ["OWNER", "ADMIN"]);

  const org = await prisma.organization.findUnique({
    where: { id: args.organizationId },
    select: { id: true, slug: true, name: true },
  });
  if (!org) throw new NotFoundError("企业");

  const invitee = await prisma.user.findUnique({
    where: { username: parsed.inviteeUsername },
    select: { id: true, status: true },
  });
  if (!invitee) throw new NotFoundError("用户");
  if (invitee.status !== "ACTIVE") {
    throw new ValidationError("该用户当前不可被邀请");
  }
  if (invitee.id === args.actorId) {
    throw new ValidationError("不能邀请自己");
  }

  const existingMember = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: invitee.id } },
    select: { role: true },
  });
  if (existingMember) {
    throw new ConflictError("该用户已经是企业成员");
  }

  // 同 org × 同 invitee 已有 PENDING 邀请 → 拒绝（避免重复邀请）。
  const existingInvite = await prisma.organizationInvite.findFirst({
    where: { organizationId: org.id, inviteeId: invitee.id, status: "PENDING" },
    select: { id: true },
  });
  if (existingInvite) {
    throw new ConflictError("该用户已有待处理的邀请");
  }

  let invite;
  try {
    invite = await prisma.organizationInvite.create({
      data: {
        organizationId: org.id,
        inviterId: args.actorId,
        inviteeId: invitee.id,
        role: parsed.role,
        message: parsed.message,
      },
      select: { id: true },
    });
  } catch (err) {
    // 并发产生 PENDING 时部分唯一索引兜底
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ConflictError("该用户已有待处理的邀请");
    }
    throw err;
  }

  void notifyOrgInvite({
    inviteeId: invitee.id,
    inviterId: args.actorId,
    organizationName: org.name,
    organizationSlug: org.slug,
  });

  return invite;
}

/** 撤销邀请。OWNER / ADMIN 可。仅 PENDING 可撤。 */
export async function cancelInvite(args: { inviteId: string; actorId: string }) {
  const invite = await prisma.organizationInvite.findUnique({
    where: { id: args.inviteId },
    select: { id: true, organizationId: true, status: true },
  });
  if (!invite) throw new NotFoundError("邀请");
  if (invite.status !== "PENDING") {
    throw new ValidationError("仅待响应邀请可撤销");
  }
  await assertOrgRole(invite.organizationId, args.actorId, ["OWNER", "ADMIN"]);
  await prisma.organizationInvite.update({
    where: { id: invite.id },
    data: { status: "CANCELED", respondedAt: new Date() },
  });
}

/** 被邀请人响应邀请。事务内：邀请 → ACCEPTED + 写 member；或 → REJECTED。 */
export async function respondToInvite(args: {
  inviteId: string;
  userId: string;
  accept: boolean;
}) {
  const invite = await prisma.organizationInvite.findUnique({
    where: { id: args.inviteId },
    select: {
      id: true,
      organizationId: true,
      inviterId: true,
      inviteeId: true,
      role: true,
      status: true,
      organization: { select: { name: true, slug: true } },
    },
  });
  if (!invite) throw new NotFoundError("邀请");
  if (invite.inviteeId !== args.userId) {
    throw new ForbiddenError("无法响应他人邀请");
  }
  if (invite.status !== "PENDING") {
    throw new ValidationError("该邀请已处理");
  }

  await prisma.$transaction(async (tx) => {
    // 原子 finalize：updateMany WHERE status=PENDING 防并发双响应
    const updated = await tx.organizationInvite.updateMany({
      where: { id: invite.id, status: "PENDING" },
      data: {
        status: args.accept ? "ACCEPTED" : "REJECTED",
        respondedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      throw new ConflictError("邀请状态已变更，请刷新");
    }
    if (args.accept) {
      // 接受时写 member；若已经是成员（外部直接 join 的并发场景）则忽略
      try {
        await tx.organizationMember.create({
          data: {
            organizationId: invite.organizationId,
            userId: invite.inviteeId,
            role: invite.role,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          // 已是成员 → 静默
        } else {
          throw err;
        }
      }
    }
  });

  void notifyOrgInviteResponse({
    inviterId: invite.inviterId,
    responderId: args.userId,
    organizationName: invite.organization.name,
    organizationSlug: invite.organization.slug,
    accepted: args.accept,
  });
}

/** 调整成员角色（OWNER → ADMIN/MEMBER 等）。仅 OWNER 可改其他人；OWNER 自身角色不可降级（需先转让所有权）。 */
export async function updateMemberRole(args: {
  organizationId: string;
  actorId: string;
  targetUserId: string;
  role: OrgRole;
}) {
  const parsed = UpdateMemberRoleSchema.parse({ role: args.role });

  const org = await prisma.organization.findUnique({
    where: { id: args.organizationId },
    select: { id: true, ownerId: true },
  });
  if (!org) throw new NotFoundError("企业");

  // 只有 OWNER 可改角色
  if (org.ownerId !== args.actorId) {
    throw new ForbiddenError("仅企业所有者可调整成员角色");
  }
  if (args.targetUserId === org.ownerId) {
    throw new ValidationError("所有者角色不可在此处修改");
  }

  const target = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: org.id, userId: args.targetUserId },
    },
    select: { role: true },
  });
  if (!target) throw new NotFoundError("成员");

  await prisma.organizationMember.update({
    where: {
      organizationId_userId: { organizationId: org.id, userId: args.targetUserId },
    },
    data: { role: parsed.role },
  });
}

/** 移除成员。OWNER / ADMIN 可；OWNER 不可被移除；ADMIN 不能移除其他 ADMIN。 */
export async function removeMember(args: {
  organizationId: string;
  actorId: string;
  targetUserId: string;
}) {
  const org = await prisma.organization.findUnique({
    where: { id: args.organizationId },
    select: { id: true, slug: true, name: true, ownerId: true },
  });
  if (!org) throw new NotFoundError("企业");

  const [actorMembership, targetMembership] = await Promise.all([
    prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: args.actorId } },
      select: { role: true },
    }),
    prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: args.targetUserId } },
      select: { role: true },
    }),
  ]);

  if (!actorMembership || (actorMembership.role !== "OWNER" && actorMembership.role !== "ADMIN")) {
    throw new ForbiddenError("仅管理员可移除成员");
  }
  if (!targetMembership) throw new NotFoundError("成员");

  if (targetMembership.role === "OWNER") {
    throw new ValidationError("不能移除企业所有者");
  }
  // ADMIN 不能移除其他 ADMIN（防止互删）
  if (
    actorMembership.role === "ADMIN" &&
    targetMembership.role === "ADMIN"
  ) {
    throw new ForbiddenError("管理员之间不能互相移除");
  }
  // 不能移除自己（leave 走另一个 action）
  if (args.actorId === args.targetUserId) {
    throw new ValidationError("请使用「退出企业」按钮");
  }

  await prisma.organizationMember.delete({
    where: {
      organizationId_userId: { organizationId: org.id, userId: args.targetUserId },
    },
  });

  void notifyOrgMemberRemoved({
    memberId: args.targetUserId,
    actorId: args.actorId,
    organizationName: org.name,
    organizationSlug: org.slug,
  });
}

/** 主动退出企业。OWNER 不能退出（需先解散或转移）。 */
export async function leaveOrganization(args: {
  organizationId: string;
  userId: string;
}) {
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: args.organizationId, userId: args.userId },
    },
    select: { role: true },
  });
  if (!membership) throw new NotFoundError("成员资格");
  if (membership.role === "OWNER") {
    throw new ValidationError("所有者不能退出，需先解散企业或转让所有权");
  }
  await prisma.organizationMember.delete({
    where: {
      organizationId_userId: { organizationId: args.organizationId, userId: args.userId },
    },
  });
}

/** 校验 actor 在 org 内属于指定角色集，否则抛 ForbiddenError。 */
async function assertOrgRole(
  organizationId: string,
  userId: string,
  allowed: OrgRole[],
): Promise<void> {
  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true },
  });
  if (!membership || !allowed.includes(membership.role)) {
    throw new ForbiddenError("权限不足");
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
