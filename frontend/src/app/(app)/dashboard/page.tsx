"use client";

import * as React from "react";
import Link from "next/link";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLEmptyState } from "@/components/tenderlens/empty-state";
import { TLCardSkeleton } from "@/components/tenderlens/skeleton-blocks";
import { TLTrialBanner } from "@/components/tenderlens/trial-banner";
import { TLOnboardingChecklist } from "@/components/tenderlens/onboarding-checklist";
import { TLButton } from "@/components/tenderlens/button";
import { TLUpgradeOfferBanner } from "@/components/tenderlens/upgrade-offer-banner";
import { TLDashboardHero } from "@/components/tenderlens/dashboard-hero";
import {
  TLDashboardAttentionPanel,
  type AttentionItem,
} from "@/components/tenderlens/dashboard-attention-panel";
import { useAuth } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/api";
import { useBilling } from "@/hooks/use-billing";
import { useOnboardingChecklist } from "@/hooks/use-onboarding-checklist";
import { useUpgradeOffers } from "@/hooks/use-upgrade-offers";

export default function DashboardPage() {
  const auth = useAuth();
  const { subscription } = useBilling();
  const {
    items: checklistItems,
    reload: reloadChecklist,
    completedCount,
  } = useOnboardingChecklist();
  const {
    items: offers,
    track: trackOffer,
    reload: reloadOffers,
  } = useUpgradeOffers();

  const [activeOrgId, setActiveOrgId] = React.useState<string | null>(null);
  const [trialNow, setTrialNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!auth.isReady) return;
    setActiveOrgId(getActiveOrgId());
  }, [auth.isReady]);

  React.useEffect(() => {
    setTrialNow(Date.now());
  }, [subscription?.trialEndsAt]);

  if (!auth.isReady) {
    return (
      <TenderLensAppShell title="Dashboard" subtitle="Loading">
        <TLCardSkeleton />
      </TenderLensAppShell>
    );
  }

  const activeMembership =
    auth.me?.orgs.find((membership) => membership.org.id === activeOrgId) ??
    auth.me?.orgs[0] ??
    null;
  const activeOrg = activeMembership?.org ?? null;
  const orgCount = auth.me?.orgs.length ?? 0;
  const isEmailVerified = Boolean(auth.me?.user.emailVerifiedAt);
  const offer = offers[0];
  const isTrial = subscription?.status === "TRIALING";
  const checklistTotal = checklistItems.length;
  const checklistRemaining = Math.max(0, checklistTotal - completedCount);
  const trialDaysLeft =
    subscription?.trialEndsAt != null
      ? Math.max(
          0,
          Math.ceil(
            (new Date(subscription.trialEndsAt).getTime() - trialNow) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;
  const hasUrgentTrial =
    subscription?.status === "EXPIRED" ||
    (isTrial && trialDaysLeft != null && trialDaysLeft <= 3);
  const showChecklist = checklistTotal > 0 && checklistRemaining > 0;
  const showAccountAlert = Boolean(offer || (subscription && hasUrgentTrial));

  const rawAttentionItems: Array<AttentionItem | null> = [
    !isEmailVerified
      ? {
          title: "Verify your email address",
          description: "Keep billing updates, invites, and reminders deliverable.",
          href: "/settings/business",
          ctaLabel: "Open settings",
          tone: "warning" as const,
        }
      : null,
    showChecklist
      ? {
          title: `Finish ${checklistRemaining} onboarding ${
            checklistRemaining === 1 ? "step" : "steps"
          }`,
          description: "Complete setup so your tender workflow is ready.",
          href: "/dashboard",
          ctaLabel: "Continue setup",
          tone: "default" as const,
        }
      : null,
    subscription?.status === "EXPIRED"
      ? {
          title: "Your trial has expired",
          description: "Upgrade to restore full access.",
          href: "/pricing",
          ctaLabel: "View plans",
          tone: "warning" as const,
        }
      : isTrial && trialDaysLeft != null && trialDaysLeft <= 3
        ? {
            title: `Trial ends in ${trialDaysLeft} ${
              trialDaysLeft === 1 ? "day" : "days"
            }`,
            description: "Choose a plan before access changes.",
            href: "/pricing",
            ctaLabel: "Compare plans",
            tone: "warning" as const,
          }
        : null,
    {
      title: "Review open tenders",
      description: "Browse live opportunities and save the ones worth tracking.",
      href: "/tenders",
      ctaLabel: "Browse tenders",
      tone: "success" as const,
    },
  ];
  const attentionItems = (rawAttentionItems.filter(Boolean) as AttentionItem[]).slice(
    0,
    3,
  );

  return (
    <TenderLensAppShell
      title="Dashboard"
      subtitle={activeOrg?.name ?? "Workspace"}
      description="Start with the next useful action."
    >
      <div className="space-y-6">
        <TLDashboardHero
          greeting={
            auth.me?.user.name ? `Welcome back, ${auth.me.user.name}` : "Welcome back"
          }
          headline={
            activeOrg
              ? `What needs attention for ${activeOrg.name}`
              : "Choose an organization and start reviewing tenders"
          }
          description={
            activeOrg
              ? "Handle setup, review urgent account items, or jump straight into open tenders."
              : "Create or select an organization, then begin building your tender pipeline."
          }
          activeOrgLabel={activeOrg?.name ?? "No active organization"}
          actions={[
            { href: "/tenders", label: "Browse tenders" },
            { href: "/orgs", label: "Manage organization", variant: "secondary" },
          ]}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <TLSection
              title="Needs Attention"
              description="The few things worth handling before you move on."
            >
              <TLDashboardAttentionPanel items={attentionItems} />
            </TLSection>

            {showChecklist ? (
              <TLSection title="Setup Checklist">
                <TLOnboardingChecklist
                  items={checklistItems}
                  onChanged={reloadChecklist}
                />
              </TLSection>
            ) : null}

            {showAccountAlert ? (
              <TLSection title="Account Alert">
                <div className="grid gap-4">
                  {offer ? (
                    <TLUpgradeOfferBanner
                      offer={offer}
                      onTrack={async (name) => {
                        await trackOffer(offer.id, name, { source: "dashboard" });
                        if (name === "dismiss" || name === "accept") {
                          reloadOffers();
                        }
                      }}
                    />
                  ) : null}

                  {subscription && hasUrgentTrial ? (
                    <TLTrialBanner sub={subscription} />
                  ) : null}
                </div>
              </TLSection>
            ) : null}
          </div>

          <div className="space-y-6">
            {orgCount === 0 ? (
              <TLEmptyState
                title="No organizations yet"
                description="Create your first organization before tracking tenders."
                actionLabel="Go to Organizations"
                onAction={() => (window.location.href = "/orgs")}
              />
            ) : null}

            <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
              <div className="space-y-1">
                <div className="font-display text-lg font-extrabold">
                  Fast Actions
                </div>
                <div className="text-sm text-muted-foreground">
                  Shortcuts for the common next move.
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                <Link href="/tenders">
                  <TLButton className="w-full justify-between">
                    Browse open tenders
                  </TLButton>
                </Link>
                <Link href="/orgs">
                  <TLButton variant="secondary" className="w-full">
                    Manage organizations
                  </TLButton>
                </Link>
                {hasUrgentTrial ? (
                  <Link href="/pricing">
                    <TLButton variant="ghost" className="w-full">
                      Review plans
                    </TLButton>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TenderLensAppShell>
  );
}
