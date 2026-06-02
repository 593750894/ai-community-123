import { requireAuth } from "@/lib/auth/guard";
import { success, error } from "@/lib/response";
import { countUnreadNotifications } from "@/lib/notifications/queries";

export async function GET() {
  try {
    const user = await requireAuth();
    const count = await countUnreadNotifications(user.id);
    return success({ count });
  } catch (err) {
    return error(err);
  }
}
