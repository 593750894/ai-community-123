import { error, success } from "@/lib/response";
import { listPublicWorkflowItems } from "@/lib/commerce/queries";
import {
  WORKFLOW_ITEM_CATEGORIES,
  type WorkflowItemCategory,
} from "@/lib/commerce/schemas";

/**
 * GET /api/marketplace/workflow-items?category=...&q=...&page=...
 * 公共列表（仅 PUBLISHED / SOLD_OUT）。
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawCategory = url.searchParams.get("category") ?? undefined;
    const category =
      rawCategory && (WORKFLOW_ITEM_CATEGORIES as readonly string[]).includes(rawCategory)
        ? (rawCategory as WorkflowItemCategory)
        : undefined;
    const q = url.searchParams.get("q")?.trim() || undefined;
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(
      48,
      Math.max(1, Number(url.searchParams.get("pageSize")) || 24),
    );

    const result = await listPublicWorkflowItems({
      category,
      q,
      page,
      pageSize,
    });
    return success(result);
  } catch (err) {
    return error(err);
  }
}
