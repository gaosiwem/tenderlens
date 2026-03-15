"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLUsageMeter } from "@/components/tenderlens/usage-meter";
import { useBilling } from "@/hooks/use-billing";
import { useUsage } from "@/hooks/use-usage";
import { openPortal } from "@/lib/billing.api";
import { trackBillingEvent } from "@/lib/billing-analytics.api";
import { TLTrialBanner } from "@/components/tenderlens/trial-banner";
import { TLPastDueBanner } from "@/components/tenderlens/past-due-banner";
import { TLInvoiceList } from "@/components/tenderlens/invoice-list";
import { TLSeatUpgradeCard } from "@/components/tenderlens/seat-upgrade-card";
import { TLPlanChangeCard } from "@/components/tenderlens/plan-change-card";
import { listInvoices } from "@/lib/invoices.api";
import { listOrgMembers } from "@/lib/org.api";
import type { OrgInvoice } from "@/lib/invoices.types";
import type { OrgMember } from "@/lib/org.types";
import { formatPlanDisplayName } from "@/lib/billing.types";
import { CreditCard, ExternalLink, Sparkles, Users } from "lucide-react";

export default function BillingSettingsPage() {
  const { subscription, loading: subLoading, reload: reloadSub } = useBilling();
  const { usage, loading: usageLoading } = useUsage();
  const [opening, setOpening] = React.useState(false);
  const [invoices, setInvoices] = React.useState<OrgInvoice[]>([]);
  const [canManageBilling, setCanManageBilling] = React.useState(false);

  type OrgMemberWithCurrent = OrgMember & { isCurrentUser?: boolean };

  React.useEffect(() => {
    (async () => {
      const r = await listInvoices();
      if (r.ok) setInvoices(r.data.items);

      // Check billing admin permission
      const members = await listOrgMembers();
      if (members.ok) {
        const currentMember = members.data.items?.find(
          (m: OrgMemberWithCurrent) => Boolean(m.isCurrentUser),
        );
        setCanManageBilling(
          currentMember?.isBillingAdmin ||
            currentMember?.role === "ADMIN" ||
            currentMember?.role === "OWNER",
        );
      }
    })();
  }, []);

  async function portal() {
    setOpening(true);
    await trackBillingEvent("portal_opened");
    const res = await openPortal();
    setOpening(false);
    if (!res.ok) {
      toast.error("Failed to open billing portal", {
        description: res.error.message,
      });
      return;
    }
    if (res.data.portalUrl) {
      window.location.href = res.data.portalUrl;
    }
  }

  const isFree =
    !subscription ||
    subscription.plan === "FREE" ||
    subscription.plan === "TRIAL" ||
    subscription.status === "TRIALING";
  const planLabel = formatPlanDisplayName(
    subscription?.plan,
    subscription?.status,
  );
  const memberLimit = usage?.limits.maxMembers;
  const membersUsed = subscription?.seatsUsed ?? 0;
  const membersAllowed =
    memberLimit === "seats"
      ? (subscription?.seatsPurchased ?? 1)
      : typeof memberLimit === "number"
        ? memberLimit
        : null;
  const usesSeatBilling = memberLimit === "seats";

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Settings">
      <TLSection
        title="Billing & Subscription"
        description="Manage your plan, billing details, and monitor your monthly usage limits."
        right={
          <div className="flex items-center gap-2">
            {isFree && (
              <Link href="/pricing">
                <TLButton leftIcon={<Sparkles className="h-4 w-4" />}>
                  Upgrade
                </TLButton>
              </Link>
            )}
            <TLButton
              variant="secondary"
              onClick={portal}
              disabled={
                opening || subLoading || !subscription?.stripeCustomerId
              }
              leftIcon={<CreditCard className="h-4 w-4" />}
              rightIcon={<ExternalLink className="h-3 w-3" />}
            >
              {opening ? "Opening..." : "Stripe Portal"}
            </TLButton>
          </div>
        }
      >
        <div className="grid gap-6">
          {subscription?.status === "PAST_DUE" ? (
            <TLPastDueBanner sub={subscription} />
          ) : subscription &&
            (subscription.status === "TRIALING" ||
              subscription.status === "EXPIRED") ? (
            <TLTrialBanner sub={subscription} />
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-background p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Current Plan
                  </div>
                  <div className="mt-2 text-2xl font-bold font-display tracking-tight text-primary">
                    {planLabel}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5 uppercase font-bold tracking-tighter">
                    Status:{" "}
                    <span
                      className={`px-1.5 py-0.5 rounded-md ${
                        subscription?.status === "ACTIVE" ||
                        subscription?.status === "TRIALING"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                      }`}
                    >
                      {subscription ? subscription.status : "ACTIVE"}
                    </span>
                  </div>
                </div>
                {!isFree && subscription?.currentPeriodEnd && (
                  <div className="text-right text-xs text-muted-foreground uppercase font-bold tracking-widest">
                    Next renewal
                    <div className="mt-1 text-sm font-extrabold text-foreground tabular-nums">
                      {new Date(
                        subscription.currentPeriodEnd,
                      ).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            </div>

              <div className="rounded-2xl border border-border bg-background p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Team Members
                    </div>
                    <div className="mt-2 text-2xl font-bold font-display tracking-tight flex items-center gap-2">
                      <Users className="w-5 h-5 text-muted-foreground" />
                      <span>
                        {membersUsed}
                        {membersAllowed !== null ? (
                          <>
                            {" "}
                            <span className="text-muted-foreground/30 font-light">
                              /
                            </span>{" "}
                            {membersAllowed}
                          </>
                        ) : (
                          " / Unlimited"
                        )}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground font-medium">
                      {membersAllowed !== null && membersUsed >= membersAllowed
                        ? usesSeatBilling
                          ? "Limit reached. Buy more seats in billing."
                          : "Member limit reached for your plan."
                        : "Available member capacity for your team."}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* In-App Billing Controls - RevenueSprint4 */}
            {subscription && subscription.stripeSubscriptionId && usesSeatBilling && (
              <div className="grid gap-4">
                <TLSeatUpgradeCard
                  sub={subscription}
                canManageBilling={canManageBilling}
                onUpdated={async () => {
                  await reloadSub();
                }}
              />
              <TLPlanChangeCard
                sub={subscription}
                canManageBilling={canManageBilling}
                onUpdated={async () => {
                  await reloadSub();
                }}
              />
            </div>
          )}

          {usageLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground animate-pulse border border-border border-dashed rounded-2xl">
              Loading usage data...
            </div>
          ) : usage ? (
            <TLUsageMeter usage={usage} />
          ) : (
            <div className="rounded-2xl border border-border border-dashed p-12 text-center text-muted-foreground bg-muted/10">
              Usage data unavailable for your current plan.
            </div>
          )}

          <TLInvoiceList items={invoices} />
        </div>
      </TLSection>
    </TenderLensAppShell>
  );
}
