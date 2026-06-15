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
// Stage 17.5：改状态扩展为「带原因 + 期限」的禁言流程。SUSPENDED 不再踢出登录，仅 BANNED 踢。
// 全部禁止 admin 操作自己（避免锁死自己 / 自己降权）。
// 元数据 / 标签在 users-meta.ts（client-safe）。

function isRole(v: string): v is AdminRoleValue {
  return (ADMIN_ROLE_VALUES as readonly string[]).includes(v);
}
function isStatus(v: string): v is AdminStatusValue {
  return (ADMIN_STATUS_VALUES as readonly string[]).includes(v);
}

const MAX_REASON_LEN = 200;
const MAX_SUSPENSION_DAYS = 365; // 一年；超过用 BANNED
const MIN_SUSPENSION_MINUTES = 5; // 防误填 0 立刻自愈

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

/**
 * Stage 17.5：admin 改状态。
 *
 * SUSPENDED 接受额外字段：
 *   - reason: 必填（≤200 字）
 *   - suspendUntil: 可选 ISO 字符串。空 = 永久禁言。
 *
 * 行为差异：
 *   - SUSPENDED：不踢出登录；写 suspension_* 列；用户进站后写入路径被拒。
 *   - BANNED：仍踢出（bump tokensValidAfter）；同时清空 suspension_* 列（终态）。
 *   - ACTIVE：清空 suspension_* 列（如果之前是 SUSPENDED 也对应 unsuspend）。
 */
export async function adminSetUserStatus(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = formData.get("userId");
  const status = formData.get("status");
  if (typeof userId !== "string" || !userId) return;
  if (typeof status !== "string" || !isStatus(status)) return;
  if (userId === admin.id) return;

  const reasonRaw = formData.get("reason");
  const untilRaw = formData.get("suspendUntil");
  const reason =
    typeof reasonRaw === "string" ? reasonRaw.trim().slice(0, MAX_REASON_LEN) : "";
  let suspendUntil: Date | null = null;
  if (typeof untilRaw === "string" && untilRaw.trim()) {
    const parsed = new Date(untilRaw);
    if (!Number.isNaN(parsed.getTime())) {
      const now = Date.now();
      const min = now + MIN_SUSPENSION_MINUTES * 60_000;
      const max = now + MAX_SUSPENSION_DAYS * 86_400_000;
      const clamped = Math.max(min, Math.min(parsed.getTime(), max));
      suspendUntil = new Date(clamped);
    }
  }

  // SUSPENDED 必须有 reason；否则当作误操作不写库。
  if (status === "SUSPENDED" && !reason) {
    revalidatePath("/admin/users");
    return;
  }

  const before = await prisma.user
    .findUnique({
      where: { id: userId },
      select: {
        status: true,
        username: true,
        suspendedUntil: true,
        suspensionReason: true,
      },
    })
    .catch(() => null);
  if (!before) {
    revalidatePath("/admin/users");
    return;
  }

  // 准备 update 数据
  let data: Record<string, unknown>;
  let auditMetadata: Record<string, unknown>;
  let forcedLogout = false;
  if (status === "SUSPENDED") {
    data = {
      status,
      suspensionReason: reason,
      suspendedUntil: suspendUntil,
      suspendedAt: new Date(),
      suspendedById: admin.id,
      // 不 bump tokensValidAfter — 让用户保持登录可见禁言原因 banner
    };
    auditMetadata = {
      username: before.username,
      statusBefore: before.status,
      statusAfter: status,
      reason,
      suspendedUntil: suspendUntil?.toISOString() ?? null,
      forcedLogout,
    };
  } else if (status === "BANNED") {
    forcedLogout = true;
    data = {
      status,
      tokensValidAfter: new Date(),
      // 终态清空 suspension 元数据；以历史 audit log 为准
      suspensionReason: null,
      suspendedUntil: null,
      suspendedAt: null,
      suspendedById: null,
    };
    auditMetadata = {
      username: before.username,
      statusBefore: before.status,
      statusAfter: status,
      forcedLogout,
    };
  } else {
    // ACTIVE：解除禁言（如果之前是 SUSPENDED）
    data = {
      status,
      suspensionReason: null,
      suspendedUntil: null,
      suspendedAt: null,
      suspendedById: null,
    };
    auditMetadata = {
      username: before.username,
      statusBefore: before.status,
      statusAfter: status,
      forcedLogout,
      unsuspended: before.status === "SUSPENDED",
    };
  }

  // 与之前完全一致的状态 + 一致的元数据则跳过
  if (
    before.status === status &&
    status !== "SUSPENDED" // SUSPENDED 允许「重新禁言」覆盖原因 / 期限
  ) {
    revalidatePath("/admin/users");
    return;
  }

  const ok = await prisma.user
    .update({ where: { id: userId }, data })
    .then(() => true)
    .catch(() => false);
  if (ok) {
    await createAuditLog({
      adminId: admin.id,
      action: "USER_STATUS_CHANGE",
      targetType: "User",
      targetId: userId,
      metadata: auditMetadata,
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

/**
 * Stage 17.5：cron / 兜底入口：批量解除到期禁言。
 *
 * 实现避免大事务：findMany 取 candidate id → updateMany WHERE status='SUSPENDED' AND suspendedUntil<=now
 * 并发安全（updateMany 是原子的，多 cron 同时跑只有第一个吃到 candidate）。
 *
 * 返回解除数量，便于 cron 端 log。
 */
export async function autoRestoreExpiredSuspensions({
  limit = 500,
  now = new Date(),
}: { limit?: number; now?: Date } = {}): Promise<{ restored: number }> {
  const candidates = await prisma.user.findMany({
    where: {
      status: "SUSPENDED",
      suspendedUntil: { lte: now },
    },
    select: { id: true, username: true, suspensionReason: true, suspendedUntil: true },
    take: limit,
    orderBy: { suspendedUntil: "asc" },
  });
  if (!candidates.length) return { restored: 0 };

  const result = await prisma.user.updateMany({
    where: {
      id: { in: candidates.map((c) => c.id) },
      status: "SUSPENDED",
      suspendedUntil: { lte: now },
    },
    data: {
      status: "ACTIVE",
      suspensionReason: null,
      suspendedUntil: null,
      suspendedAt: null,
      suspendedById: null,
    },
  });

  // 不写 AuditLog 避免日志爆炸；写过的人工 SUSPEND 记录已经在 USER_STATUS_CHANGE 落痕。
  return { restored: result.count };
}
