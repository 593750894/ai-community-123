import { redirect } from "next/navigation";

import { getCurrentUser, getSession, type CurrentUser } from "@/lib/auth/session";
import { UnauthorizedError } from "@/lib/errors";

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

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
