import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { created, error, success } from "@/lib/response";
import { createWorkflowItem } from "@/lib/commerce/actions";
import { listMyWorkflowItems } from "@/lib/commerce/queries";
import {
  CreateWorkflowItemSchema,
  WORKFLOW_ITEM_STATUSES,
  type WorkflowItemStatusValue,
} from "@/lib/commerce/schemas";

/** GET /api/me/workflow-items — 卖家自己的全部商品。 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status") ?? undefined;
    const status =
      rawStatus && (WORKFLOW_ITEM_STATUSES as readonly string[]).includes(rawStatus)
        ? (rawStatus as WorkflowItemStatusValue)
        : undefined;
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(
      48,
      Math.max(1, Number(url.searchParams.get("pageSize")) || 24),
    );
    const result = await listMyWorkflowItems(user.id, {
      status,
      page,
      pageSize,
    });
    return success(result);
  } catch (err) {
    return error(err);
  }
}

/** POST /api/me/workflow-items — 创建草稿。 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json().catch(() => ({}));
    const parsed = CreateWorkflowItemSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("参数校验失败", parsed.error.flatten().fieldErrors);
    }
    const result = await createWorkflowItem(parsed.data, user.id);
    return created(result, "已创建草稿");
  } catch (err) {
    return error(err);
  }
}
