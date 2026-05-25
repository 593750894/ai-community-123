import { prisma } from "@/lib/db";
import { success, error } from "@/lib/response";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return success({ db: "ok" }, "API is running");
  } catch (err) {
    return error(err);
  }
}
