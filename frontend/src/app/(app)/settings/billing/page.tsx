"use client";

import * as React from "react";
import Link from "next/link";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLUsageMeter } from "@/components/tenderlens/usage-meter";
import { useBilling } from "@/hooks/use-billing";
import { useUsage } from "@/hooks/use-usage";
import { TLTrialBanner } from "@/components/tenderlens/trial-banner";
import { TLPastDueBanner } from "@/components/tenderlens/past-due-banner";
import { TLInvoiceList } from "@/components/tenderlens/invoice-list";
import { listInvoices } from "@/lib/invoices.api";
import type { OrgInvoice } from "@/lib/invoices.types";
import { formatPlanDisplayName } from "@/lib/billing.types";
import { CreditCard, Sparkles, Users } from "lucide-react";

export default function BillingSettingsPage() {
  const { subscription, loading: subLoading } = useBilling();
  const { usage, loading: usageLoading } = useUsage();
  const [invoices, setInvoices] = React.useState<OrgInvoice[]>([]);

  React.useEffect(() => {
    (async () => {
      const r = await listInvoices();
      if (r.ok) setInvoices(r.data.items);
    })();
  }, []);

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
            <Link href="/pricing">
              <TLButton
                variant="secondary"
                disabled={subLoading}
                leftIcon={<CreditCard className="h-4 w-4" />}
              >
                Change Plan
              </TLButton>
            </Link>
          </div>
        }
      >
        <div className="grid gap-6">
          <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
            Payments and subscription upgrades are handled through PayFast.
          </div>
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
                        ? "Member limit reached for your current plan."
                        : "Available member capacity for your team."}
                    </div>
                  </div>
                </div>
              </div>
            </div>

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
