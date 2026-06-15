import { requireAuth } from "@/lib/auth/guard";
import { requireActiveUser } from "@/lib/auth/suspension";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import {
  deleteWorkflowItem,
  transitionWorkflowItemStatus,
  updateWorkflowItem,
} from "@/lib/commerce/actions";
import { getMyWorkflowItem } from "@/lib/commerce/queries";
import {
  UpdateWorkflowItemSchema,
  WorkflowItemStatusActionSchema,
} from "@/lib/commerce/schemas";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/me/workflow-items/:id — 单品详情（仅卖家自己）。 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const item = await getMyWorkflowItem(id, user.id);
    if (!item) throw new NotFoundError("商品");
    return success(item);
  } catch (err) {
    return error(err);
  }
}

/**
 * PATCH /api/me/workflow-items/:id
 * Body: 全字段更新（partial）；额外支持 `status: "PUBLISHED"|"DRAFT"|"ARCHIVED"` 触发状态切换。
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth();
    await requireActiveUser(user);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // 状态切换是独立 schema，避免与 update 字段混淆
    if (body && typeof body === "object" && "status" in body) {
      const parsedStatus = WorkflowItemStatusActionSchema.safeParse({
        status: (body as { status: unknown }).status,
      });
      if (!parsedStatus.success) {
        throw new ValidationError(
          "状态参数非法",
          parsedStatus.error.flatten().fieldErrors,
        );
      }
      await transitionWorkflowItemStatus(id, parsedStatus.data, user.id);
      // 状态切换后允许同时更新其它字段（去掉 status 再走 update）
      const { status: _drop, ...rest } = body as Record<string, unknown>;
      void _drop;
      if (Object.keys(rest).length > 0) {
        const parsedRest = UpdateWorkflowItemSchema.safeParse(rest);
        if (!parsedRest.success) {
          throw new ValidationError(
            "字段校验失败",
            parsedRest.error.flatten().fieldErrors,
          );
        }
        await updateWorkflowItem(id, parsedRest.data, user.id);
      }
      return success({ id }, "已更新");
    }

    const parsed = UpdateWorkflowItemSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }
    await updateWorkflowItem(id, parsed.data, user.id);
    return success({ id }, "已更新");
  } catch (err) {
    return error(err);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    await deleteWorkflowItem(id, user.id);
    return success({ id }, "已删除");
  } catch (err) {
    return error(err);
  }
}
