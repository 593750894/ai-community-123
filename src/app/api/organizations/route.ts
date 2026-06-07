import { listPublicOrganizations } from "@/lib/organizations/queries";
import { error, success } from "@/lib/response";

/** GET /api/organizations — 公共企业列表（含搜索 / 行业过滤 / 是否仅认证）。 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q");
    const industry = url.searchParams.get("industry");
    const verifiedOnly = url.searchParams.get("verifiedOnly") === "1";
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(
      48,
      Math.max(1, Number(url.searchParams.get("pageSize")) || 24),
    );
    const result = await listPublicOrganizations({
      q,
      industry,
      verifiedOnly,
      page,
      pageSize,
    });
    return success(result);
  } catch (err) {
    return error(err);
  }
}
