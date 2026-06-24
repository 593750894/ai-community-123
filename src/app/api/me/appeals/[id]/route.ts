import { requireAuth } from "@/lib/auth/guard";
import { success, error } from "@/lib/response";
import { cancelAppeal } from "@/lib/content/appeals";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await cancelAppeal(id, user.id);
    return success(null, "申诉已撤回");
  } catch (err) {
    return error(err);
  }
}
