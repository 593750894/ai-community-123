import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { prisma } from "@/lib/db";
import type { User } from "@/lib/db";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "seedland_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  username: string;
  /** JWT 签发时间（秒）。jose 自动写入 `iat`，这里显式暴露以便会话失效检查。 */
  iat?: number;
  // exp 由 jose 自动写入
}

// env.AUTH_SECRET_KEY 是已 base64 解码的 32 字节 Buffer（Uint8Array 兼容）。
// 旧实现 `new TextEncoder().encode(raw)` 把 base64 字符串当 UTF-8 字节，
// 有效熵被压缩；jose 仍接受但密钥强度低于 .env.example 声称的 32B。
function getSecretKey(): Uint8Array {
  return env.AUTH_SECRET_KEY;
}

/**
 * Stage 12.5 audit M9：把 iat slop 集中到这一处。
 *
 * 旧实现 `setIssuedAt()` 用当前秒签发；但 session 检查 `iat * 1000 <= tokensValidAfter.getTime()`
 * 在「同一秒内 force-logout + 重新登录 / 改密 + 重发 cookie」的场景里会把刚发出的新 token
 * 误判为失效（iat 是秒精度，tokensValidAfter 是毫秒精度，刚 +1s 的 bump 永远 >= 同秒 iat*1000）。
 *
 * 修复：iat 用「下一秒后」的时间戳（`ceil(now/1000) + 1`），保证 iat*1000 严格大于任何用
 * `Date.now() + 1000` 模式生成的 tokensValidAfter。代价：新 token 看起来比实际签发时间晚 ~1s，
 * jose verify 不要求 iat <= now，所以不会拒签；exp 也用绝对秒数避免被 iat 推迟。
 */
export async function encodeSession(
  payload: SessionPayload,
): Promise<string> {
  const iatSec = Math.ceil(Date.now() / 1000) + 1;
  const expSec = iatSec + SESSION_TTL_SECONDS;
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iatSec)
    .setExpirationTime(expSec)
    .sign(getSecretKey());
}

export async function decodeSession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.userId !== "string" ||
      typeof payload.username !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      username: payload.username,
      iat: typeof payload.iat === "number" ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}

export async function createSessionCookie(payload: SessionPayload) {
  const token = await encodeSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Stage 12.5 修：把「DB 暂时不可用」与「token 无效 / 用户被封禁」明确区分开。
 * 之前 `.catch(() => null)` 会把 Neon 抖动同样当作未登录，导致 SSE 客户端进入 401 退避循环、
 * 同时整页 server component 退化为匿名视图。现在 DB 错误向上抛，由调用方决定 503 / fallback；
 * 仅 token 非法 / 用户被封禁 / iat 过期 才返回 null。
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const decoded = await decodeSession(token);
  if (!decoded) return null;

  // Stage 9：tokensValidAfter + 状态守卫提前到 getSession，
  // 确保所有调用者（包括只取 userId 的 server action 写入路径）
  // 都看到强制下线 / 封禁 / 注销账号为「未登录」。
  // DB 错误不吞 — 让调用方决定 503/降级。
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { status: true, tokensValidAfter: true },
  });
  if (!user) return null;
  if (
    user.status === "BANNED" ||
    user.status === "DELETED" ||
    user.status === "SUSPENDED"
  ) {
    return null;
  }
  if (
    user.tokensValidAfter &&
    typeof decoded.iat === "number" &&
    decoded.iat * 1000 <= user.tokensValidAfter.getTime()
  ) {
    return null;
  }
  return decoded;
}

export type CurrentUser = Pick<
  User,
  | "id"
  | "email"
  | "username"
  | "name"
  | "avatar"
  | "bio"
  | "role"
  | "status"
  | "industryRole"
  | "expertise"
  | "favoriteTools"
  | "portfolioLinks"
  | "contact"
  | "isProfilePublic"
  | "createdAt"
>;

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      avatar: true,
      bio: true,
      role: true,
      status: true,
      industryRole: true,
      expertise: true,
      favoriteTools: true,
      portfolioLinks: true,
      contact: true,
      isProfilePublic: true,
      tokensValidAfter: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  // Stage 9：会话失效检查 —— JWT iat 早于 user.tokensValidAfter 视为已失效。
  // 用 <= 比较以匹配秒级 iat 与毫秒级 tokensValidAfter，避免同秒边界假阴性。
  if (
    user.tokensValidAfter &&
    typeof session.iat === "number" &&
    session.iat * 1000 <= user.tokensValidAfter.getTime()
  ) {
    return null;
  }

  // 已封禁 / 已注销 / 已暂停 用户视同未登录（与 getSession 保持一致）
  if (
    user.status === "BANNED" ||
    user.status === "DELETED" ||
    user.status === "SUSPENDED"
  ) {
    return null;
  }

  // 不向上游暴露 tokensValidAfter
  const { tokensValidAfter: _drop, ...rest } = user;
  void _drop;
  return rest;
}
