import { requireAuth } from "@/lib/auth/guard";
import { success, error } from "@/lib/response";

export async function GET() {
  try {
    const user = await requireAuth();
    return success(user);
  } catch (err) {
    return error(err);
  }
}
