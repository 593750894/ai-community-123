import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { prisma } from "@/lib/db";
import type { User } from "@/lib/db";

export const SESSION_COOKIE = "seedland_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  username: string;
  /** JWT 签发时间（秒）。jose 自动写入 `iat`，这里显式暴露以便会话失效检查。 */
  iat?: number;
  // exp 由 jose 自动写入
}

function getSecretKey(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw) {
    throw new Error(
      "AUTH_SECRET is not set. Add it to web/.env (base64-encoded 32 bytes).",
    );
  }
  return new TextEncoder().encode(raw);
}

export async function encodeSession(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
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

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const decoded = await decodeSession(token);
  if (!decoded) return null;

  // Stage 9：tokensValidAfter + 状态守卫提前到 getSession，
  // 确保所有调用者（包括只取 userId 的 server action 写入路径）
  // 都看到强制下线 / 封禁 / 注销账号为「未登录」。
  const user = await prisma.user
    .findUnique({
      where: { id: decoded.userId },
      select: { status: true, tokensValidAfter: true },
    })
    .catch(() => null);
  if (!user) return null;
  if (user.status === "BANNED" || user.status === "DELETED") return null;
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

  // 已封禁 / 已注销 用户视同未登录
  if (user.status === "BANNED" || user.status === "DELETED") {
    return null;
  }

  // 不向上游暴露 tokensValidAfter
  const { tokensValidAfter: _drop, ...rest } = user;
  void _drop;
  return rest;
}
