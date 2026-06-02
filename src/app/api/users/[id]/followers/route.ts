import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { success, error } from "@/lib/response";
import { listFollowers } from "@/lib/follows/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") || undefined;
    const pageSize = Number(url.searchParams.get("pageSize")) || undefined;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!user) throw new NotFoundError("用户");

    const session = await getSession();
    const result = await listFollowers({
      userId: id,
      viewerId: session?.userId ?? null,
      cursor,
      pageSize,
    });

    return success(result);
  } catch (err) {
    return error(err);
  }
}
