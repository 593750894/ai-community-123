import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listActiveMembershipPlans } from "@/lib/commerce/queries";
import {
  BILLING_CYCLE_LABEL,
  formatPrice,
  type BillingCycleValue,
} from "@/lib/commerce/schemas";

export const metadata: Metadata = {
  title: "会员计划 · SeedLand · V",
  description: "解锁更多 AI 视频创作能力：高级模型额度、商业授权与社区荣誉。",
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plans = await listActiveMembershipPlans();
  const hasPlans = plans.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="会员计划"
        title="解锁更多 AI 视频创作能力"
        description="选择适合你的订阅档位 — 高级模型额度、商业授权、社区荣誉与早期功能。"
      />
      <div className="space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        {hasPlans ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((p, idx) => (
              <PlanCard key={p.id} plan={p} highlight={idx === 1} />
            ))}
          </section>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="会员计划即将上线"
            description="平台还没有发布订阅档位。可以先从工作流市集找找灵感。"
            action={
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href="/marketplace" />}
              >
                逛逛工作流市集
              </Button>
            }
          />
        )}

        <p className="text-center text-[11px] text-muted-foreground/70">
          所有订阅可随时取消，余下周期内仍可继续使用。支付完成后立即开通。
        </p>
      </div>
    </>
  );
}

interface PlanProps {
  plan: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    priceCents: number;
    currency: string;
    cycle: string;
    features: string[];
    trialDays: number;
  };
  highlight?: boolean;
}

function PlanCard({ plan, highlight }: PlanProps) {
  const cycleLabel =
    BILLING_CYCLE_LABEL[plan.cycle as BillingCycleValue] ?? plan.cycle;
  return (
    <Card
      variant={highlight ? "accent" : "default"}
      className="flex h-full flex-col p-6"
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          {plan.description && (
            <p className="mt-1 text-xs text-muted-foreground">
              {plan.description}
            </p>
          )}
        </div>
        {highlight && <Badge variant="primary">推荐</Badge>}
      </header>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight">
          {formatPrice(plan.priceCents, plan.currency)}
        </span>
        <span className="text-xs text-muted-foreground">/ {cycleLabel}</span>
      </div>
      {plan.trialDays > 0 && (
        <p className="mt-1 text-[11px] text-primary">
          首 {plan.trialDays} 天免费试用
        </p>
      )}

      {plan.features.length > 0 && (
        <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 size-3.5 text-primary" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-6">
        {/* Stage 10.1 仅展示计划；下单 / 支付集成在 10.2 / 10.3 阶段补齐 */}
        <Button
          variant={highlight ? "default" : "outline"}
          className="w-full"
          disabled
          aria-disabled
        >
          支付开通（即将上线）
        </Button>
      </div>
    </Card>
  );
}
