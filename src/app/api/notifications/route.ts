import { requireAuth } from "@/lib/auth/guard";
import { success, error } from "@/lib/response";
import { listNotifications } from "@/lib/notifications/queries";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const onlyUnread = url.searchParams.get("unread") === "1";
    const pageSize = Number(url.searchParams.get("pageSize")) || undefined;

    const result = await listNotifications({
      userId: user.id,
      cursor: cursor || undefined,
      pageSize,
      onlyUnread,
    });

    return success(result);
  } catch (err) {
    return error(err);
  }
}
