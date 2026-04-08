"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLPlanCard } from "@/components/tenderlens/plan-card";
import { completeSandboxCheckout, startPlanCheckout } from "@/lib/billing.api";
import { useBilling } from "@/hooks/use-billing";
import { trackBillingEvent } from "@/lib/billing-analytics.api";
import { formatPlanDisplayName } from "@/lib/billing.types";

export default function PricingPage() {
  const router = useRouter();
  const { subscription } = useBilling();
  const [loading, setLoading] = React.useState<string | null>(null);
  const currentPlan = subscription?.plan ?? "TRIAL";
  const trialFeatures = [
    "Unlimited team members during trial",
    "View Open, Awarded, Closed, and Cancelled tenders",
    "Unlimited watched tenders",
    "Unlimited AI queries during trial",
    "Advanced email and SMS alerts",
    "Tender comparison, workspace, exports, and risk scoring",
  ];
  const proOnlyFeatures = [
    "Up to 5 team members",
    "Unlimited watchlist",
    "Unlimited AI queries per month",
    "Tender comparison (Compare)",
    "Team workspace & tasks",
    "Bid checklists & risk scoring",
    "PDF & XLSX exports",
    "SMS & Email alerts",
  ];
  const businessOnlyFeatures = [
    "Includes everything from Pro",
    "Up to 15 team members",
    "Advanced alert automations",
    "Workspace categories & task governance",
    "Bid analytics dashboards",
    "API-style exports and integrations",
    "Dedicated onboarding assistance",
    "Priority support & SLAs",
    "Custom feature limits",
    "Dedicated account manager",
  ];
  const proFeatures = [...proOnlyFeatures];
  const businessFeatures = [...businessOnlyFeatures];

  async function logPlanEvent(
    name: string,
    plan: "TRIAL" | "PRO" | "BUSINESS",
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

    if (res.data.gateway === "PAYFAST_SANDBOX_LOCAL") {
      const completed = await completeSandboxCheckout();
      if (!completed.ok) {
        toast.error("Checkout failed", { description: completed.error.message });
        return;
      }
      router.push("/billing/success");
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
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <TLPlanCard
            plan="TRIAL"
            title="Trial with Full Access"
            priceLabel="Full access during trial"
            ctaLabel="Current Plan"
            onCta={() => {}}
            current={subscription}
            features={trialFeatures}
          />
          <TLPlanCard
            plan="PRO"
            title={formatPlanDisplayName("PRO")}
            priceLabel="R299 / month"
            ctaLabel={loading === "PRO" ? "Connecting..." : "Upgrade to Pro"}
            highlight
            loading={loading === "PRO"}
            onCta={() => upgrade("PRO")}
            current={subscription}
            features={proFeatures}
          />
          <TLPlanCard
            plan="BUSINESS"
            title={formatPlanDisplayName("BUSINESS")}
            priceLabel="R1499 / month"
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
