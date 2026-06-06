import { requireAuth } from "@/lib/auth/guard";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { error, success } from "@/lib/response";
import { paginatedResponse, parsePagination } from "@/lib/pagination";
import { listOrdersForAdmin } from "@/lib/commerce/order-queries";
import {
  ORDER_STATUSES,
  ORDER_TYPES,
  PAYMENT_METHODS,
  type OrderStatusValue,
  type OrderTypeValue,
  type PaymentMethodValue,
} from "@/lib/commerce/schemas";

/**
 * GET /api/admin/orders?status=&type=&paymentMethod=&q=&from=&to=&page=&pageSize=
 *
 * 全量订单列表（仅 admin）。q 同时匹配 orderNo（精确）+ buyer name/username（模糊）。
 * 日期 from/to 是 createdAt 范围；to 自动到当日 23:59:59.999。
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN") throw new ForbiddenError();

    const url = new URL(request.url);
    const sp = url.searchParams;
    const status = pickEnum(sp.get("status"), ORDER_STATUSES) as
      | OrderStatusValue
      | undefined;
    const type = pickEnum(sp.get("type"), ORDER_TYPES) as
      | OrderTypeValue
      | undefined;
    const paymentMethod = pickEnum(
      sp.get("paymentMethod"),
      PAYMENT_METHODS,
    ) as PaymentMethodValue | undefined;
    const q = (sp.get("q") ?? "").trim() || undefined;
    const from = parseDate(sp.get("from"), false);
    const to = parseDate(sp.get("to"), true);
    if (from && to && from > to) {
      throw new ValidationError("起始日期不能晚于结束日期");
    }
    const { page, pageSize } = parsePagination(url);

    const { items, total } = await listOrdersForAdmin({
      status,
      type,
      paymentMethod,
      q,
      from,
      to,
      page,
      pageSize,
    });
    return success(paginatedResponse(items, total, page, pageSize));
  } catch (err) {
    return error(err);
  }
}

function pickEnum(
  raw: string | null,
  list: readonly string[],
): string | undefined {
  if (!raw) return undefined;
  return list.includes(raw) ? raw : undefined;
}

function parseDate(raw: string | null, endOfDay: boolean): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}
