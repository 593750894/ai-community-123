import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError } from "@/lib/errors";
import {
  getViewerMembership,
  listOrganizationMembers,
} from "@/lib/organizations/queries";
import { error, success } from "@/lib/response";

/** GET /api/me/organizations/[id]/members — 成员列表（仅成员可见）。 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const membership = await getViewerMembership(id, user.id);
    if (!membership) throw new ForbiddenError("仅企业成员可查看成员列表");
    const items = await listOrganizationMembers(id);
    return success({ items });
  } catch (err) {
    return error(err);
  }
}
