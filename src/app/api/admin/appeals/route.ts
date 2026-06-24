import { requireAdminApi } from "@/lib/auth/guard";
import { success, error } from "@/lib/response";
import { listAdminAppeals } from "@/lib/content/appeals";
import { APPEAL_STATUSES } from "@/lib/content/schemas";

export async function GET(request: Request) {
  try {
    await requireAdminApi();
    const url = new URL(request.url);
    const statusParam = url.searchParams.get("status");
    const status =
      statusParam && (APPEAL_STATUSES as readonly string[]).includes(statusParam)
        ? (statusParam as (typeof APPEAL_STATUSES)[number])
        : undefined;
    const q = url.searchParams.get("q")?.trim() || undefined;
    const page = Number(url.searchParams.get("page") ?? 1) || 1;
    const result = await listAdminAppeals({ status, q, page });
    return success(result);
  } catch (err) {
    return error(err);
  }
}
