import { headers } from "next/headers";

import { requireAuth } from "@/lib/auth/guard";
import { ValidationError } from "@/lib/errors";
import { created, error } from "@/lib/response";
import { createOrder } from "@/lib/commerce/orders";
import { CreateOrderSchema } from "@/lib/commerce/schemas";
import { createRateLimiter } from "@/lib/rate-limit";

const orderLimiter = createRateLimiter({
  limit: 10,
  windowMs: 60_000,
  name: "下单",
});

/** POST /api/orders — 创建 PENDING 订单 + 拿支付链接。 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    orderLimiter.check(user.id);

    const body = await request.json().catch(() => ({}));
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(
        "参数校验失败",
        parsed.error.flatten().fieldErrors,
      );
    }

    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("host") ?? "localhost:3000";
    const baseUrl = `${proto}://${host}`;

    const result = await createOrder(user.id, parsed.data, baseUrl);
    return created(result, "已创建订单");
  } catch (err) {
    return error(err);
  }
}
