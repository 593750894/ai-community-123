import { NotFoundError } from "@/lib/errors";
import { getOrganizationBySlug } from "@/lib/organizations/queries";
import { error, success } from "@/lib/response";

/** GET /api/organizations/[slug] — 单个企业公开信息。 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const org = await getOrganizationBySlug(slug);
    if (!org) throw new NotFoundError("企业");
    return success(org);
  } catch (err) {
    return error(err);
  }
}
