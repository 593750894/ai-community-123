import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

import type { CurrentUser } from "@/lib/auth/session";

/**
 * Stage 17.5：禁言状态判定 + 自动到期解除。
 *
 * 设计：SUSPENDED 用户保留登录态（read-only），所以判断写入权限不能再靠
 * `getSession() === null`，必须在 server action / API 入口显式调用 requireActiveUser()。
 *
 * suspendedUntil 语义：
 * - null         = 永久禁言（直到 admin 手动解除）
 * - 未来时间戳   = 到时自动解除（cron + 自愈两路）
 * - 过去时间戳   = 应被 cron 解除；如果 cron 漏跑由 ensureActive() 兜底（懒解除）
 */

export interface SuspensionSnapshot {
  status: "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";
  suspendedUntil: Date | null;
  suspensionReason?: string | null;
}

/** 给定 user-like 对象判断是否处于「写入应被拒」的禁言态。 */
export function isUserActivelySuspended(
  user: Pick<SuspensionSnapshot, "status" | "suspendedUntil">,
  now: Date = new Date(),
): boolean {
  if (user.status !== "SUSPENDED") return false;
  if (user.suspendedUntil === null) return true; // 永久禁言
  return user.suspendedUntil.getTime() > now.getTime();
}

/** 给定 user-like 对象判断 cron 是否应当将其解除回 ACTIVE。 */
export function shouldAutoRestoreSuspension(
  user: Pick<SuspensionSnapshot, "status" | "suspendedUntil">,
  now: Date = new Date(),
): boolean {
  if (user.status !== "SUSPENDED") return false;
  if (user.suspendedUntil === null) return false;
  return user.suspendedUntil.getTime() <= now.getTime();
}

type SuspensionInput = {
  id: string;
  status: SuspensionSnapshot["status"];
  suspendedUntil?: Date | null;
  suspensionReason?: string | null;
};

/**
 * 拒绝处于活跃禁言态的用户走写入路径。供 Server Action / API 入口使用。
 *
 * 设计要点：
 *   - 入参带 suspendedUntil / suspensionReason 时常态 0 DB hit（CurrentUser 已自带）。
 *   - 如果到期但 cron 还没跑，就地 updateMany 解除并放行；并发安全。
 *   - 永久 / 未到期 → 抛 SuspendedError（403 + code=SUSPENDED + details）。
 *
 * 与 requireUser 配合：通常先 requireUser/requireAuth 拿到 session，再调
 * requireActiveUser(user) 拒禁言。
 */
export async function requireActiveUser(user: SuspensionInput | CurrentUser): Promise<void> {
  if (user.status === "ACTIVE") return;
  if (user.status !== "SUSPENDED") {
    // BANNED / DELETED 不该到这里（session 层已拦），但兜底抛错。
    throw new SuspendedError({ suspendedUntil: null, reason: null });
  }
  const snapshot: SuspensionSnapshot = {
    status: user.status,
    suspendedUntil: user.suspendedUntil ?? null,
    suspensionReason: user.suspensionReason ?? null,
  };
  if (shouldAutoRestoreSuspension(snapshot)) {
    // 到期 → 就地解禁。并发安全：updateMany WHERE status='SUSPENDED' AND suspendedUntil<=now。
    const result = await prisma.user.updateMany({
      where: {
        id: user.id,
        status: "SUSPENDED",
        suspendedUntil: { lte: new Date() },
      },
      data: {
        status: "ACTIVE",
        suspensionReason: null,
        suspendedUntil: null,
        suspendedAt: null,
        suspendedById: null,
      },
    });
    if (result.count > 0) return;
    // 失败兜底：再读一次 DB 看 cron 是否已解除
    const fresh = await prisma.user.findUnique({
      where: { id: user.id },
      select: { status: true },
    });
    if (fresh?.status === "ACTIVE") return;
  }
  throw new SuspendedError({
    suspendedUntil: user.suspendedUntil ?? null,
    reason: user.suspensionReason ?? null,
  });
}

/**
 * 只拿到 userId 的调用方（典型：使用 `getSession()` 而非 `getCurrentUser()` 的 server action）
 * 用这个变体，单次 DB hit 查 status 再判定。
 */
export async function requireActiveUserById(userId: string): Promise<void> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      suspendedUntil: true,
      suspensionReason: true,
    },
  });
  if (!row) return; // 不该发生；session 层已校验存在
  await requireActiveUser({ id: userId, ...row });
}

/**
 * 403 + 专用 code "SUSPENDED"，便于 API response 层把 reason / suspendedUntil 传给前端。
 * 不继承 ForbiddenError 因为后者 code 是 "FORBIDDEN" readonly，无法在子类改写。
 */
export class SuspendedError extends AppError {
  readonly suspendedUntil: Date | null;
  readonly reason: string | null;
  constructor(args: { suspendedUntil: Date | null; reason: string | null }) {
    super("账户处于禁言状态，无法执行该操作", "SUSPENDED", 403, {
      suspendedUntil: args.suspendedUntil?.toISOString() ?? null,
      reason: args.reason,
    });
    this.name = "SuspendedError";
    this.suspendedUntil = args.suspendedUntil;
    this.reason = args.reason;
  }
}
