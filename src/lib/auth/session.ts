import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { prisma } from "@/lib/db";
import type { User } from "@/lib/db";

export const SESSION_COOKIE = "seedland_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  username: string;
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
    return { userId: payload.userId, username: payload.username };
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
  return decodeSession(token);
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
  | "industryRole"
  | "expertise"
  | "favoriteTools"
  | "portfolioLinks"
  | "contact"
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
      industryRole: true,
      expertise: true,
      favoriteTools: true,
      portfolioLinks: true,
      contact: true,
      createdAt: true,
    },
  });
  return user;
}
