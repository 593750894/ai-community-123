import { redirect } from "next/navigation";

import { getCurrentUser, getSession, type CurrentUser } from "@/lib/auth/session";
import { requireActiveUser as enforceActive } from "@/lib/auth/suspension";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export async function requireUser(redirectTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const params = new URLSearchParams({ next: redirectTo });
    redirect(`/auth/login?${params.toString()}`);
  }
  return user;
}

export async function requireSession(redirectTo: string) {
  const session = await getSession();
  if (!session) {
    const params = new URLSearchParams({ next: redirectTo });
    redirect(`/auth/login?${params.toString()}`);
  }
  return session;
}

// 阶段 11：管理后台
// 只允许 role=ADMIN 的用户进入。MOD 也视为普通用户，避免误开权限。
// 未登录 → 跳登录；已登录但非管理员 → 跳首页。
export async function requireAdmin(
  redirectTo = "/admin",
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const params = new URLSearchParams({ next: redirectTo });
    redirect(`/auth/login?${params.toString()}`);
  }
  if (user.role !== "ADMIN") {
    redirect("/?reason=admin-only");
  }
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "ADMIN";
}

/**
 * Stage 17.1：审核员守卫。允许 MOD 与 ADMIN 进入。
 * 用于 /admin/reports 的认领 / 处理 / 驳回入口；其它 admin 区仍用 requireAdmin。
 */
export async function requireMod(
  redirectTo = "/admin/reports",
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const params = new URLSearchParams({ next: redirectTo });
    redirect(`/auth/login?${params.toString()}`);
  }
  if (user.role !== "ADMIN" && user.role !== "MOD") {
    redirect("/?reason=mod-only");
  }
  return user;
}

export function isModOrAdmin(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MOD";
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/**
 * Stage 17.2：API-context admin 守卫。`requireAdmin` 用 `redirect()` 适配 server-component；
 * API 路由需要 throw → error() 映射成 401/403 而不是 307 → 500。
 */
export async function requireAdminApi(): Promise<CurrentUser> {
  const user = await requireAuth();
  if (user.role !== "ADMIN") throw new ForbiddenError();
  return user;
}

/**
 * Stage 17.5：要求当前会话不仅登录、且处于 ACTIVE 状态（非禁言）。
 *
 * 用法：所有「创建 / 编辑 / 删除 / 互动」server action + API 入口在拿到 currentUser 后调用一次。
 * 抛 SuspendedError（403 + code=SUSPENDED + suspendedUntil + reason 细节），让上层
 * 统一返回 JSON 错误或渲染锁定页。
 *
 * 已自带懒自愈：suspendedUntil 已到期但 cron 还没跑时，写入路径就地解禁后放行。
 */
export async function requireActiveUser(): Promise<CurrentUser> {
  const user = await requireAuth();
  await enforceActive(user);
  return user;
}

/** 与 requireUser 同义但额外校验未被禁言；redirect 跳登录页。 */
export async function requireActiveUserOrRedirect(
  redirectTo: string,
): Promise<CurrentUser> {
  const user = await requireUser(redirectTo);
  await enforceActive(user);
  return user;
}

/** 旧调用方拿到 user 后想就地检查禁言；不抛重定向，抛 SuspendedError。 */
export async function assertActive(user: CurrentUser): Promise<void> {
  await enforceActive(user);
}
