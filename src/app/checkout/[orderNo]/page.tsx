import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  CheckoutPanel,
  type CheckoutOrderView,
} from "@/components/commerce/checkout-panel";
import { requireUser } from "@/lib/auth/guard";
import { AppError } from "@/lib/errors";
import {
  getOrderByNo,
  ORDER_NO_RE,
  refreshOrderStatus,
} from "@/lib/commerce/orders";
import { IS_MOCK_ENABLED } from "@/lib/payments/mock";

interface PageProps {
  params: Promise<{ orderNo: string }>;
  searchParams: Promise<{ provider?: string }>;
}

export const metadata: Metadata = {
  title: "支付订单 · SeedLand · V",
  description: "完成订单付款。",
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps) {
  const { orderNo } = await params;
  if (!ORDER_NO_RE.test(orderNo)) notFound();

  const user = await requireUser(`/checkout/${orderNo}`);

  // 进入页面时顺手过期 PENDING 单
  await refreshOrderStatus(orderNo);

  let order;
  try {
    order = await getOrderByNo(orderNo, user.id);
  } catch (err) {
    // 非本人访问 → 404（不暴露存在）
    if (err instanceof AppError) notFound();
    throw err;
  }
  if (!order) notFound();

  const { provider } = await searchParams;

  const view: CheckoutOrderView = {
    orderNo: order.orderNo,
    type: order.type,
    status: order.status,
    amountCents: order.amountCents,
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    paymentUrl: order.paymentUrl,
    expiresAt: order.expiresAt ? order.expiresAt.toISOString() : null,
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    plan: order.plan
      ? {
          slug: order.plan.slug,
          name: order.plan.name,
          cycle: order.plan.cycle,
        }
      : null,
    workflowItem: order.workflowItem
      ? {
          id: order.workflowItem.id,
          title: order.workflowItem.title,
          coverUrl: order.workflowItem.coverUrl,
          // 仅 PAID 状态下暴露下载链接
          downloadUrl:
            order.status === "PAID"
              ? order.workflowItem.downloadUrl
              : null,
          seller: order.workflowItem.seller,
        }
      : null,
  };

  return (
    <>
      <PageHeader
        eyebrow="收银台"
        title="确认订单并完成支付"
        description="30 分钟内完成付款；超时后订单将自动取消。"
        actions={
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/marketplace" />}
          >
            ← 返回市集
          </Button>
        }
      />
      <CheckoutPanel
        order={view}
        provider={provider ?? null}
        mockEnabled={IS_MOCK_ENABLED}
      />
    </>
  );
}
