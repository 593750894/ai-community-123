"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guard";
import { createAuditLog } from "@/lib/admin/audit";
import {
  ADMIN_ROLE_VALUES,
  ADMIN_STATUS_VALUES,
  type AdminRoleValue,
  type AdminStatusValue,
} from "@/lib/admin/users-meta";

// Stage 9：admin 用户管理。三个动作：改角色 / 改状态 / 强制下线。
// 全部禁止 admin 操作自己（避免锁死自己 / 自己降权）。
// 元数据 / 标签在 users-meta.ts（client-safe）。

function isRole(v: string): v is AdminRoleValue {
  return (ADMIN_ROLE_VALUES as readonly string[]).includes(v);
}
function isStatus(v: string): v is AdminStatusValue {
  return (ADMIN_STATUS_VALUES as readonly string[]).includes(v);
}

export async function adminSetUserRole(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = formData.get("userId");
  const role = formData.get("role");
  if (typeof userId !== "string" || !userId) return;
  if (typeof role !== "string" || !isRole(role)) return;
  if (userId === admin.id) return; // 不允许改自己的角色

  const before = await prisma.user
    .findUnique({ where: { id: userId }, select: { role: true, username: true } })
    .catch(() => null);
  if (!before || before.role === role) {
    revalidatePath("/admin/users");
    return;
  }

  const ok = await prisma.user
    .update({ where: { id: userId }, data: { role } })
    .then(() => true)
    .catch(() => false);
  if (ok) {
    await createAuditLog({
      adminId: admin.id,
      action: "USER_ROLE_CHANGE",
      targetType: "User",
      targetId: userId,
      metadata: {
        username: before.username,
        roleBefore: before.role,
        roleAfter: role,
      },
    });
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function adminSetUserStatus(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = formData.get("userId");
  const status = formData.get("status");
  if (typeof userId !== "string" || !userId) return;
  if (typeof status !== "string" || !isStatus(status)) return;
  if (userId === admin.id) return;

  const before = await prisma.user
    .findUnique({
      where: { id: userId },
      select: { status: true, username: true },
    })
    .catch(() => null);
  if (!before || before.status === status) {
    revalidatePath("/admin/users");
    return;
  }

  // SUSPENDED / BANNED 都顺带踢出所有现存会话
  const shouldKick = status === "SUSPENDED" || status === "BANNED";
  const ok = await prisma.user
    .update({
      where: { id: userId },
      data: shouldKick
        ? { status, tokensValidAfter: new Date() }
        : { status },
    })
    .then(() => true)
    .catch(() => false);
  if (ok) {
    await createAuditLog({
      adminId: admin.id,
      action: "USER_STATUS_CHANGE",
      targetType: "User",
      targetId: userId,
      metadata: {
        username: before.username,
        statusBefore: before.status,
        statusAfter: status,
        forcedLogout: shouldKick,
      },
    });
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function adminForceLogoutUser(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) return;
  if (userId === admin.id) return; // 不准把自己踢下线

  const before = await prisma.user
    .findUnique({ where: { id: userId }, select: { username: true } })
    .catch(() => null);
  if (!before) return;

  const ok = await prisma.user
    .update({
      where: { id: userId },
      data: { tokensValidAfter: new Date() },
    })
    .then(() => true)
    .catch(() => false);
  if (ok) {
    await createAuditLog({
      adminId: admin.id,
      action: "FORCE_LOGOUT_USER",
      targetType: "User",
      targetId: userId,
      metadata: { username: before.username },
    });
  }
  revalidatePath("/admin/users");
}
