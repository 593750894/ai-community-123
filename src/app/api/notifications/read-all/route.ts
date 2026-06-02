import { requireAuth } from "@/lib/auth/guard";
import { success, error } from "@/lib/response";
import { markAllNotificationsRead } from "@/lib/notifications/queries";

export async function POST() {
  try {
    const user = await requireAuth();
    const count = await markAllNotificationsRead(user.id);
    return success({ count });
  } catch (err) {
    return error(err);
  }
}
