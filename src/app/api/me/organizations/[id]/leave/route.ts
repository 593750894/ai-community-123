import { requireAuth } from "@/lib/auth/guard";
import { leaveOrganization } from "@/lib/organizations/actions";
import { error, success } from "@/lib/response";

/** POST /api/me/organizations/[id]/leave — 主动退出企业。 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    await leaveOrganization({ organizationId: id, userId: user.id });
    return success({ ok: true }, "已退出企业");
  } catch (err) {
    return error(err);
  }
}
