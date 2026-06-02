import { requireAuth } from "@/lib/auth/guard";
import { success, error } from "@/lib/response";
import { markNotificationRead } from "@/lib/notifications/queries";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const updated = await markNotificationRead({
      userId: user.id,
      notificationId: id,
    });

    return success({ updated });
  } catch (err) {
    return error(err);
  }
}
