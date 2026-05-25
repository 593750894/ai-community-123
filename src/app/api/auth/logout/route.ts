import { clearSessionCookie } from "@/lib/auth/session";
import { success, error } from "@/lib/response";

export async function POST() {
  try {
    await clearSessionCookie();
    return success(null, "已退出登录");
  } catch (err) {
    return error(err);
  }
}
