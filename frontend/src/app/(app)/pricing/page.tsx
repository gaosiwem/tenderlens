"use client";

import * as React from "react";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLPlanCard } from "@/components/tenderlens/plan-card";
import { startPlanCheckout } from "@/lib/billing.api";
import { useBilling } from "@/hooks/use-billing";
import { trackBillingEvent } from "@/lib/billing-analytics.api";
import { formatPlanDisplayName } from "@/lib/billing.types";

type PublicPlan = "TRIAL" | "PRO" | "BUSINESS";

export default function PricingPage() {
  const { subscription } = useBilling();
  const [loading, setLoading] = React.useState<string | null>(null);
  const currentPlan = subscription?.plan ?? "TRIAL";

  const trialFeatures = [
    "14-day full-access trial",
    "Unlimited team members during trial",
    "Compare, workspace, exports, and alerts",
    "Compliance audit and bid review included",
  ];

  const proFeatures = [
    "Up to 5 team members",
    "Unlimited AI workflows and watchlist",
    "Open, awarded, closed, and cancelled tenders",
    "Compare, workspace, exports, and risk scoring",
    "Advanced email and SMS alerts",
    "Custom alert rules",
    "Compliance audit and bid review included",
  ];

  const businessFeatures = [
    "Everything in Pro",
    "Up to 15 team members",
    "Advanced alert automations",
    "Business profile context across AI workflows",
    "Bid analytics and integration-ready exports",
    "Priority support and SLA cover",
    "Dedicated account management",
    "Onboarding help and stronger governance",
  ];

  async function logPlanEvent(
    name: string,
    plan: PublicPlan,
    meta?: Record<string, unknown>,
  ) {
    await trackBillingEvent(name, { plan, currentPlan, ...meta });
  }

  function submitPayFastCheckout(args: {
    paymentUrl: string;
    fields: Record<string, string>;
  }) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = args.paymentUrl;
    form.style.display = "none";

    for (const [key, value] of Object.entries(args.fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
  }

  async function upgrade(plan: "PRO" | "BUSINESS") {
    await logPlanEvent("upgrade_clicked", plan);
    setLoading(plan);
    const res = await startPlanCheckout(plan, 1);
    setLoading(null);

    if (!res.ok) {
      toast.error("Checkout failed", { description: res.error.message });
      return;
    }

    submitPayFastCheckout({
      paymentUrl: res.data.paymentUrl,
      fields: res.data.fields,
    });
  }

  React.useEffect(() => {
    void trackBillingEvent("pricing_viewed", {
      currentPlan,
      plans: ["TRIAL", "PRO", "BUSINESS"],
    });
  }, [currentPlan]);

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Pricing">
      <TLSection
        title="Choose your plan"
        description="Simple monthly plans for growing tender teams."
        className="space-y-6"
      >

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <TLPlanCard
            plan="TRIAL"
            title="Trial"
            priceLabel="14 days free"
            description="Full access for evaluation."
            ctaLabel="Current Plan"
            onCta={() => {}}
            current={subscription}
            features={trialFeatures}
          />
          <TLPlanCard
            plan="PRO"
            title={formatPlanDisplayName("PRO")}
            priceLabel="R299 / month"
            description="For active tender teams."
            ctaLabel={loading === "PRO" ? "Connecting..." : "Upgrade to Pro"}
            highlight
            highlightLabel="Recommended"
            loading={loading === "PRO"}
            onCta={() => upgrade("PRO")}
            current={subscription}
            features={proFeatures}
          />
          <TLPlanCard
            plan="BUSINESS"
            title={formatPlanDisplayName("BUSINESS")}
            priceLabel="R1499 / month"
            description="For larger tender operations."
            ctaLabel={
              loading === "BUSINESS" ? "Connecting..." : "Upgrade to Business"
            }
            loading={loading === "BUSINESS"}
            onCta={() => upgrade("BUSINESS")}
            current={subscription}
            features={businessFeatures}
          />
        </div>
      </TLSection>
    </TenderLensAppShell>
  );
}
