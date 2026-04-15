"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BellRing,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLEmptyState } from "@/components/tenderlens/empty-state";
import { TLCardSkeleton } from "@/components/tenderlens/skeleton-blocks";
import { TLTrialBanner } from "@/components/tenderlens/trial-banner";
import { TLOnboardingChecklist } from "@/components/tenderlens/onboarding-checklist";
import { TLRetentionBanner } from "@/components/tenderlens/retention-banner";
import { TLButton } from "@/components/tenderlens/button";
import { TLUpgradeOfferBanner } from "@/components/tenderlens/upgrade-offer-banner";
import { TLDashboardHero } from "@/components/tenderlens/dashboard-hero";
import { TLDashboardMetricCard } from "@/components/tenderlens/dashboard-metric-card";
import {
  TLDashboardAttentionPanel,
  type AttentionItem,
} from "@/components/tenderlens/dashboard-attention-panel";
import { TLDashboardOrgSwitchboard } from "@/components/tenderlens/dashboard-org-switchboard";
import { TLDashboardSignalsCard } from "@/components/tenderlens/dashboard-signals-card";
import { useAuth } from "@/lib/auth";
import { getActiveOrgId, setActiveOrgId as persistActiveOrgId } from "@/lib/api";
import { useBilling } from "@/hooks/use-billing";
import { useOnboardingChecklist } from "@/hooks/use-onboarding-checklist";
import { listNotificationEvents } from "@/lib/notifications.api";
import { useUpgradeOffers } from "@/hooks/use-upgrade-offers";
import { formatPlanDisplayName } from "@/lib/billing.types";
import type { NotificationEvent } from "@/lib/notifications.types";

export default function DashboardPage() {
  const auth = useAuth();
  const router = useRouter();
  const { subscription, reload: reloadBilling } = useBilling();
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
  const [events, setEvents] = React.useState<NotificationEvent[]>([]);
  const [retentionEvent, setRetentionEvent] =
    React.useState<NotificationEvent | null>(null);
  const [trialNow, setTrialNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!auth.isReady) return;
    setActiveOrgId(getActiveOrgId());
  }, [auth.isReady]);

  const loadSignals = React.useCallback(async () => {
    if (!auth.isReady || !getActiveOrgId()) {
      setEvents([]);
      setRetentionEvent(null);
      return;
    }

    const result = await listNotificationEvents(20);
    if (!result.ok) {
      setEvents([]);
      setRetentionEvent(null);
      return;
    }

    setEvents(result.data.items);
    const latestRetention =
      result.data.items.find((event) => {
        const meta =
          event.meta &&
          typeof event.meta === "object" &&
          !Array.isArray(event.meta)
            ? (event.meta as Record<string, unknown>)
            : null;
        return typeof meta?.kind === "string" && meta.kind.startsWith("RETENTION_");
      }) ?? null;
    setRetentionEvent(latestRetention);
  }, [auth.isReady]);

  React.useEffect(() => {
    void loadSignals();
  }, [loadSignals, activeOrgId]);

  React.useEffect(() => {
    setTrialNow(Date.now());
  }, [subscription?.trialEndsAt]);

  if (!auth.isReady) {
    return (
      <TenderLensAppShell title="Operations Desk" subtitle="Dashboard">
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
  const planLabel = formatPlanDisplayName(subscription?.plan, subscription?.status);
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
  const signalCount = events.length;
  const readinessLabel =
    checklistTotal > 0
      ? `${completedCount}/${checklistTotal} steps done`
      : "Ready for first action";

  const rawAttentionItems: Array<AttentionItem | null> = [
    !isEmailVerified
      ? {
          title: "Verify your email address",
          description:
            "A verified inbox keeps billing updates, invites, and deadline reminders flowing to the right place.",
          href: "/settings/business",
          ctaLabel: "Open settings",
          tone: "warning" as const,
        }
      : null,
    checklistTotal > 0 && checklistRemaining > 0
      ? {
          title: `Finish ${checklistRemaining} onboarding ${
            checklistRemaining === 1 ? "step" : "steps"
          }`,
          description:
            "Complete your setup so this dashboard reflects a live tender workflow instead of a placeholder shell.",
          href: "/dashboard",
          ctaLabel: "Continue setup",
          tone: "default" as const,
        }
      : null,
    subscription?.status === "EXPIRED"
      ? {
          title: "Your trial has expired",
          description:
            "Upgrade to restore full access to workspace, exports, and the premium tools you already started using.",
          href: "/pricing",
          ctaLabel: "View plans",
          tone: "warning" as const,
        }
      : isTrial
        ? {
            title:
              trialDaysLeft != null && trialDaysLeft <= 3
                ? `Trial ends in ${trialDaysLeft} ${
                    trialDaysLeft === 1 ? "day" : "days"
                  }`
                : "Use your trial with intent",
            description:
              trialDaysLeft != null && trialDaysLeft <= 3
                ? "This is the right moment to lock in your workflow before access tightens."
                : "The more of the workflow you touch now, the more relevant the dashboard becomes.",
            href: "/pricing",
            ctaLabel: "Compare plans",
            tone:
              trialDaysLeft != null && trialDaysLeft <= 3
                ? ("warning" as const)
                : ("default" as const),
          }
        : null,
    offer
      ? {
          title: offer.title,
          description: offer.description,
          href: "/settings/billing",
          ctaLabel: offer.ctaLabel,
          tone: "default" as const,
        }
      : null,
    {
      title: "Keep your tender pipeline active",
      description:
        "Browse live tenders, open workspaces, and switch organizations to turn this dashboard into a proper control surface.",
      href: "/tenders",
      ctaLabel: "Browse tenders",
      tone: "success" as const,
    },
  ];
  const attentionItems = rawAttentionItems.filter(Boolean) as AttentionItem[];

  async function handleSwitchOrg(orgId: string) {
    if (typeof window === "undefined") return;
    if (orgId === activeOrgId) return;

    persistActiveOrgId(orgId);
    setActiveOrgId(orgId);
    await Promise.all([
      reloadBilling(),
      reloadChecklist(),
      reloadOffers(),
      loadSignals(),
    ]);
    router.refresh();
    toast.success("Organization context updated");
  }

  return (
    <TenderLensAppShell
      title="Operations Desk"
      subtitle={activeOrg?.name ? `Watching ${activeOrg.name}` : "Dashboard"}
      description="A clearer view of account health, setup progress, and the next move."
    >
      <div className="space-y-6">
        <TLDashboardHero
          greeting={
            auth.me?.user.name ? `Welcome back, ${auth.me.user.name}` : "Welcome back"
          }
          headline={
            activeOrg
              ? `Run the next move for ${activeOrg.name}`
              : "Turn this dashboard into your tender command center"
          }
          description={
            activeOrg
              ? "Track plan health, setup progress, and commercial signals from one place so you always know what deserves attention next."
              : "Choose an organization, complete the setup, and start shaping a dashboard that reflects how your team actually works."
          }
          planLabel={`${planLabel}${
            subscription?.status ? ` · ${subscription.status.replaceAll("_", " ")}` : ""
          }`}
          planTone={
            subscription?.status === "EXPIRED"
              ? "danger"
              : subscription?.status === "TRIALING"
                ? "warning"
                : "success"
          }
          roleLabel={activeMembership ? `${activeMembership.role} access` : "No active role"}
          activeOrgLabel={activeOrg?.name ?? "No active organization"}
          verificationLabel={isEmailVerified ? "Email verified" : "Verification pending"}
          readinessLabel={readinessLabel}
          actions={[
            { href: "/tenders", label: "Browse tenders" },
            {
              href:
                subscription?.status === "EXPIRED" || subscription?.status === "TRIALING"
                  ? "/pricing"
                  : "/orgs",
              label:
                subscription?.status === "EXPIRED" || subscription?.status === "TRIALING"
                  ? "Review plans"
                  : "Manage organizations",
              variant: "secondary",
            },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TLDashboardMetricCard
            label="Organization Access"
            value={`${orgCount}`}
            sublabel={
              activeOrg
                ? `${activeOrg.name} is currently in focus`
                : "Choose an organization to begin"
            }
            icon={Building2}
          />
          <TLDashboardMetricCard
            label="Plan Status"
            value={planLabel}
            sublabel={
              subscription?.status === "TRIALING" && trialDaysLeft != null
                ? `${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left in trial`
                : subscription?.status?.replaceAll("_", " ") ?? "No active billing state"
            }
            icon={ShieldCheck}
            accentClassName="from-primary via-primary/80 to-blue-300"
          />
          <TLDashboardMetricCard
            label="Setup Progress"
            value={checklistTotal > 0 ? `${completedCount}/${checklistTotal}` : "0/0"}
            sublabel={
              checklistTotal > 0
                ? `${checklistRemaining} ${checklistRemaining === 1 ? "step" : "steps"} still open`
                : "Checklist appears once onboarding starts"
            }
            icon={CheckCircle2}
            accentClassName="from-emerald-500 via-emerald-400 to-emerald-200"
          />
          <TLDashboardMetricCard
            label="Recent Signals"
            value={`${signalCount}`}
            sublabel={
              signalCount > 0
                ? "Notifications, offers, and retention cues are flowing in"
                : "No recent signal history yet"
            }
            icon={BellRing}
            accentClassName="from-amber-500 via-amber-400 to-amber-200"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <div className="space-y-6">
            <TLSection
              title="What Needs Attention"
              description="A short list of actions that make the dashboard more useful fast."
            >
              <TLDashboardAttentionPanel items={attentionItems} />
            </TLSection>

            {isTrial ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
                <TLOnboardingChecklist
                  items={checklistItems}
                  onChanged={reloadChecklist}
                />
                <div className="rounded-3xl border border-primary/20 bg-linear-to-b from-primary/10 via-background/80 to-background p-6 text-center shadow-lg shadow-primary/5">
                  <div className="flex justify-center">
                    <div className="rounded-full bg-primary/10 p-3 text-primary">
                      <Sparkles className="h-6 w-6" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="font-display text-xl font-extrabold">
                      {completedCount >= 3 ? "Momentum unlocked" : "Build the first workflow"}
                    </div>
                    <div className="text-sm leading-6 text-muted-foreground">
                      {completedCount >= 3
                        ? "You have enough setup in place to see the product’s shape. Lock in access before the trial window closes."
                        : `Complete ${Math.max(1, 3 - completedCount)} more ${
                            Math.max(1, 3 - completedCount) === 1 ? "step" : "steps"
                          } to make this dashboard reflect a live tender workflow.`}
                    </div>
                  </div>
                  <Link href="/pricing" className="mt-5 block">
                    <TLButton className="w-full">Upgrade to Pro</TLButton>
                  </Link>
                </div>
              </div>
            ) : null}

            <TLSection
              title="Signals"
              description="Commercial nudges, subscription pressure, and recent platform activity."
            >
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

                {subscription &&
                (subscription.status === "TRIALING" ||
                  subscription.status === "EXPIRED") ? (
                  <TLTrialBanner sub={subscription} />
                ) : null}

                {retentionEvent ? <TLRetentionBanner event={retentionEvent} /> : null}

                <TLDashboardSignalsCard events={events} />
              </div>
            </TLSection>
          </div>

          <div className="space-y-6">
            {orgCount === 0 ? (
              <TLEmptyState
                title="No organizations yet"
                description="Create your first organization to turn this dashboard into a working control surface."
                actionLabel="Go to Organizations"
                onAction={() => (window.location.href = "/orgs")}
              />
            ) : (
              <TLDashboardOrgSwitchboard
                orgs={auth.me?.orgs ?? []}
                activeOrgId={activeOrgId}
                onSelectOrg={handleSwitchOrg}
              />
            )}

            <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
              <div className="space-y-1">
                <div className="font-display text-lg font-extrabold">
                  Fast Actions
                </div>
                <div className="text-sm text-muted-foreground">
                  Jump straight into the areas that make this page feel alive.
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                <Link href="/tenders">
                  <TLButton
                    className="w-full justify-between"
                    rightIcon={<Sparkles className="h-4 w-4" />}
                  >
                    Browse open tenders
                  </TLButton>
                </Link>
                <Link href="/orgs">
                  <TLButton variant="secondary" className="w-full">
                    Manage organizations
                  </TLButton>
                </Link>
                <Link href="/pricing">
                  <TLButton variant="ghost" className="w-full">
                    Review plans and pricing
                  </TLButton>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TenderLensAppShell>
  );
}
