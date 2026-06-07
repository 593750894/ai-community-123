import { requireAuth } from "@/lib/auth/guard";
import { listMyInvites } from "@/lib/organizations/queries";
import { error, success } from "@/lib/response";

/** GET /api/me/invites — 我收到的所有企业邀请（含历史）。 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const valid = ["PENDING", "ACCEPTED", "REJECTED", "CANCELED"];
    const items = await listMyInvites(
      user.id,
      status && valid.includes(status)
        ? (status as "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELED")
        : null,
    );
    return success({ items });
  } catch (err) {
    return error(err);
  }
}
