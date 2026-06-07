import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError } from "@/lib/errors";
import {
  ORG_VERIFICATION_STATUSES,
  type OrgVerificationStatusValue,
} from "@/lib/organizations/schemas";
import { listAdminVerifications } from "@/lib/organizations/verification";
import { error, success } from "@/lib/response";

/** GET /api/admin/organizations/verifications?status=&q=&page=&pageSize= — admin 列表。 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();

    const url = new URL(request.url);
    const sp = url.searchParams;
    const rawStatus = sp.get("status");
    const status: OrgVerificationStatusValue | null = rawStatus
      ? rawStatus === "ALL"
        ? null
        : (ORG_VERIFICATION_STATUSES as readonly string[]).includes(rawStatus)
          ? (rawStatus as OrgVerificationStatusValue)
          : null
      : "PENDING";

    const q = (sp.get("q") ?? "").trim() || null;
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const pageSize = Math.min(
      50,
      Math.max(1, Number(sp.get("pageSize")) || 20),
    );

    const result = await listAdminVerifications({ status, q, page, pageSize });
    return success(result);
  } catch (err) {
    return error(err);
  }
}
