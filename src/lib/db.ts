import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import type { User } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env (see .env.example)."
    );
  }
  const adapter = new PrismaPg({ connectionString: url });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// 公开用户字段 — 任何对外返回都应当 select 这个集合，绝不暴露 passwordHash。
export const PUBLIC_USER_SELECT = {
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
  createdAt: true,
} as const;

export type PublicUser = Omit<User, "passwordHash" | "updatedAt">;

export { Prisma } from "@/generated/prisma/client";
export type {
  User,
  Channel,
  ChannelMember,
  Post,
  Comment,
  Work,
  Collaboration,
  Tool,
  WorkflowItem,
  Conversation,
  ConversationParticipant,
  Message,
  Like,
  Bookmark,
  Notification,
  Report,
  AuditLog,
  MembershipPlan,
  Subscription,
  Order,
  Organization,
  OrganizationMember,
} from "@/generated/prisma/client";
