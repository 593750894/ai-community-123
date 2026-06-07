import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { deleteOrganization, updateOrganization } from "@/lib/organizations/actions";
import { UpdateOrganizationSchema } from "@/lib/organizations/schemas";
import { error, success } from "@/lib/response";

/** PATCH /api/me/organizations/[id] — 更新企业基础信息（OWNER / ADMIN）。 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = UpdateOrganizationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }
    const org = await updateOrganization({
      organizationId: id,
      actorId: user.id,
      input: parsed.data,
    });
    return success(org, "已保存");
  } catch (err) {
    return error(err);
  }
}

/** DELETE /api/me/organizations/[id] — 仅 OWNER。 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    await deleteOrganization({ organizationId: id, actorId: user.id });
    return success({ ok: true }, "企业已解散");
  } catch (err) {
    return error(err);
  }
}
