import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to web/.env (see README)."
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
  Conversation,
  ConversationParticipant,
  Message,
  Like,
  Bookmark,
} from "@/generated/prisma/client";
