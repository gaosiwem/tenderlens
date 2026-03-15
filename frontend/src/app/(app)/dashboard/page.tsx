"use client";

import * as React from "react";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TenderLensStatCard } from "@/components/tenderlens/stat-card";
import { TLTableShell } from "@/components/tenderlens/table-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { TLEmptyState } from "@/components/tenderlens/empty-state";
import { TLCardSkeleton } from "@/components/tenderlens/skeleton-blocks";
import { useBilling } from "@/hooks/use-billing";
import { TLTrialBanner } from "@/components/tenderlens/trial-banner";
import { TLOnboardingChecklist } from "@/components/tenderlens/onboarding-checklist";
import { useOnboardingChecklist } from "@/hooks/use-onboarding-checklist";
import { listNotificationEvents } from "@/lib/notifications.api";
import { getActiveOrgId } from "@/lib/api";
import { TLRetentionBanner } from "@/components/tenderlens/retention-banner";
import { TLButton } from "@/components/tenderlens/button";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useUpgradeOffers } from "@/hooks/use-upgrade-offers";
import { TLUpgradeOfferBanner } from "@/components/tenderlens/upgrade-offer-banner";
import { toast } from "sonner";

export default function DashboardPage() {
  const auth = useAuth();
  const { subscription } = useBilling();
  const {
    items: checklistItems,
    reload: reloadChecklist,
    completedCount,
  } = useOnboardingChecklist();
  const [retentionEvent, setRetentionEvent] = React.useState<any>(null);

  React.useEffect(() => {
    if (!auth.isReady || !getActiveOrgId()) return;
    (async () => {
      const r = await listNotificationEvents(20);
      if (r.ok) {
        const latestRetention = r.data.items.find((it: any) =>
          it.meta?.kind?.startsWith("RETENTION_"),
        );
        setRetentionEvent(latestRetention);
      }
    })();
  }, [auth.isReady]);

  if (!auth.isReady) {
    return (
      <TenderLensAppShell title="TenderLens" subtitle="Dashboard">
        <TLCardSkeleton />
      </TenderLensAppShell>
    );
  }

  const orgCount = auth.me?.orgs.length ?? 0;
  const activeOrgId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("tl_active_org_id")
      : null;
  const activeOrg = auth.me?.orgs.find((o) => o.org.id === activeOrgId)?.org;

  const isTrial = subscription?.status === "TRIALING";

  const {
    items: offers,
    track: trackOffer,
    reload: reloadOffers,
  } = useUpgradeOffers();
  const offer = offers?.[0];

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Dashboard">
      <div className="space-y-6">
        {offer ? (
          <TLUpgradeOfferBanner
            offer={offer}
            onTrack={async (name) => {
              await trackOffer(offer.id, name, { source: "dashboard" });
              if (name === "dismiss" || name === "accept") reloadOffers();
            }}
          />
        ) : null}

        {subscription &&
        (subscription.status === "TRIALING" ||
          subscription.status === "EXPIRED") ? (
          <TLTrialBanner sub={subscription} />
        ) : null}

        {retentionEvent && <TLRetentionBanner event={retentionEvent} />}

        {isTrial && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TLOnboardingChecklist
                items={checklistItems}
                onChanged={reloadChecklist}
              />
            </div>
            <div className="flex flex-col justify-center p-6 rounded-2xl border border-primary/20 bg-primary/5 text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-3 rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="font-display font-bold">
                  {completedCount >= 3 ? "You're ready!" : "Almost there"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {completedCount >= 3
                    ? "You've seen the core value of TenderLens. Upgrade now to keep these features forever."
                    : `Complete ${3 - completedCount} more ${3 - completedCount === 1 ? "task" : "tasks"} to unlock the full potential of your trial.`}
                </div>
              </div>
              <Link href="/pricing" className="block">
                <TLButton className="w-full">Upgrade to Pro</TLButton>
              </Link>
            </div>
          </div>
        )}

        <TLSection
          title="Overview"
          description="Baseline workspace health. Upload and analysis arrive in Sprint 2."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <TenderLensStatCard
              label="Organizations"
              value={`${orgCount}`}
              sublabel="Memberships linked to your account"
            />
            <TenderLensStatCard
              label="Active org"
              value={activeOrg?.name ?? "None"}
              sublabel="Selected context for actions"
            />
            <TenderLensStatCard
              label="Uploads"
              value="0"
              sublabel="Not available in Sprint 1"
            />
            <TenderLensStatCard
              label="Analyses"
              value="0"
              sublabel="Not available in Sprint 1"
            />
          </div>
        </TLSection>

        <TLSection
          title="Your organizations"
          description="Switch context in the Organizations screen."
        >
          {orgCount === 0 ? (
            <TLEmptyState
              title="No organizations yet"
              description="Create your first organization to continue."
              actionLabel="Go to Organizations"
              onAction={() => (window.location.href = "/orgs")}
            />
          ) : (
            <TLTableShell title="Organizations">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auth.me?.orgs.map((o) => (
                    <TableRow key={o.org.id}>
                      <TableCell className="font-semibold">
                        {o.org.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {o.org.slug}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {o.role}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TLTableShell>
          )}
        </TLSection>
      </div>
    </TenderLensAppShell>
  );
}
