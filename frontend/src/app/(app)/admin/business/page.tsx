"use client";

import * as React from "react";
import { toast } from "sonner";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AdminBusinessOrg,
  getAdminBusinessAccountManager,
  listAdminBusinessOrgs,
  setAdminBusinessAccountManager,
  updateAdminBusinessOnboarding,
} from "@/lib/admin-business.api";
import { formatDateTime } from "@/lib/date-utils";

type OnboardingStatus =
  | "NOT_REQUESTED"
  | "REQUESTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DECLINED";

export default function AdminBusinessSuccessPage() {
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [orgs, setOrgs] = React.useState<AdminBusinessOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = React.useState<string | null>(null);
  const [managerName, setManagerName] = React.useState("");
  const [managerEmail, setManagerEmail] = React.useState("");
  const [managerNotes, setManagerNotes] = React.useState("");
  const [supportSlaHours, setSupportSlaHours] = React.useState("4");
  const [onboardingStatus, setOnboardingStatus] =
    React.useState<OnboardingStatus>("NOT_REQUESTED");
  const [onboardingNotes, setOnboardingNotes] = React.useState("");

  const selectedOrg = React.useMemo(
    () => orgs.find((o) => o.orgId === selectedOrgId) ?? null,
    [orgs, selectedOrgId],
  );

  async function load() {
    setLoading(true);
    const res = await listAdminBusinessOrgs({
      q: search || undefined,
      onboardingStatus:
        statusFilter === "ALL" ? undefined : statusFilter.toUpperCase(),
      take: 150,
    });
    setLoading(false);

    if (!res.ok) {
      toast.error("Failed to load BUSINESS organizations", {
        description: res.error.message,
      });
      return;
    }

    setOrgs(res.data.items);
    const first = res.data.items[0]?.orgId ?? null;
    if (!selectedOrgId || !res.data.items.some((o) => o.orgId === selectedOrgId)) {
      setSelectedOrgId(first);
    }
  }

  async function loadSelectedOrgDetails(orgId: string) {
    const org = orgs.find((row) => row.orgId === orgId);
    if (!org) return;

    setManagerName(org.accountManagerName ?? "");
    setManagerEmail(org.accountManagerEmail ?? "");
    setManagerNotes("");
    setSupportSlaHours(String(org.supportSlaHours || 4));
    setOnboardingStatus(
      (org.onboardingAssistanceStatus as OnboardingStatus) ?? "NOT_REQUESTED",
    );
    setOnboardingNotes(org.onboardingAssistanceNotes ?? "");

    const manager = await getAdminBusinessAccountManager(orgId);
    if (manager.ok) {
      setManagerName(manager.data.name ?? "");
      setManagerEmail(manager.data.email ?? "");
      setManagerNotes(manager.data.notes ?? "");
      setSupportSlaHours(String(manager.data.supportSlaHours || 4));
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  React.useEffect(() => {
    if (selectedOrgId) void loadSelectedOrgDetails(selectedOrgId);
  }, [selectedOrgId, orgs]);

  return (
    <div className="space-y-6">
      <TLSection
        title="Business Success Admin"
        description="Manage dedicated account managers, support SLAs, and onboarding workflow for BUSINESS organizations."
      >
        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px_auto]">
            <Input
              placeholder="Search by org name or slug"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="ALL">All Onboarding Statuses</option>
              <option value="NOT_REQUESTED">Not Requested</option>
              <option value="REQUESTED">Requested</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="DECLINED">Declined</option>
            </select>
            <TLButton onClick={() => void load()}>Refresh</TLButton>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardContent className="space-y-2 p-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : orgs.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No BUSINESS organizations found.
                </div>
              ) : (
                orgs.map((org) => (
                  <button
                    type="button"
                    key={org.orgId}
                    onClick={() => setSelectedOrgId(org.orgId)}
                    className={`w-full rounded-md border px-3 py-2 text-left ${
                      selectedOrgId === org.orgId
                        ? "border-primary bg-primary/10"
                        : "border-border"
                    }`}
                  >
                    <div className="font-semibold">{org.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {org.slug} | {org.membersCount} members |{" "}
                      {org.onboardingAssistanceStatus}
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-4">
              {!selectedOrg ? (
                <div className="text-sm text-muted-foreground">
                  Select an organization to manage.
                </div>
              ) : (
                <>
                  <div className="text-sm font-semibold">
                    {selectedOrg.name} ({selectedOrg.slug})
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Plan: {selectedOrg.subscription?.plan ?? "-"} | Status:{" "}
                    {selectedOrg.subscription?.status ?? "-"} | Seats:{" "}
                    {selectedOrg.subscription?.seatsUsed ?? 0}/
                    {selectedOrg.subscription?.seatsPurchased ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Onboarding requested:{" "}
                    {selectedOrg.onboardingAssistanceRequestedAt
                      ? formatDateTime(selectedOrg.onboardingAssistanceRequestedAt)
                      : "-"}
                  </div>

                  <div className="space-y-2 rounded-md border border-border p-3">
                    <div className="text-sm font-semibold">
                      Dedicated Account Manager
                    </div>
                    <Input
                      placeholder="Manager name"
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                    />
                    <Input
                      placeholder="Manager email"
                      value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)}
                    />
                    <Textarea
                      placeholder="Manager notes"
                      value={managerNotes}
                      onChange={(e) => setManagerNotes(e.target.value)}
                    />
                    <Input
                      type="number"
                      min={1}
                      max={168}
                      placeholder="Support SLA (hours)"
                      value={supportSlaHours}
                      onChange={(e) => setSupportSlaHours(e.target.value)}
                    />
                    <TLButton
                      onClick={async () => {
                        if (!selectedOrg) return;
                        const res = await setAdminBusinessAccountManager(
                          selectedOrg.orgId,
                          {
                            name: managerName.trim() || null,
                            email: managerEmail.trim() || null,
                            notes: managerNotes.trim() || null,
                            supportSlaHours: Math.max(
                              1,
                              Math.min(168, Number(supportSlaHours || 4)),
                            ),
                          },
                        );
                        if (!res.ok) {
                          toast.error("Failed to save account manager", {
                            description: res.error.message,
                          });
                          return;
                        }
                        toast.success("Account manager saved");
                        await load();
                      }}
                    >
                      Save Account Manager
                    </TLButton>
                  </div>

                  <div className="space-y-2 rounded-md border border-border p-3">
                    <div className="text-sm font-semibold">
                      Onboarding Assistance
                    </div>
                    <select
                      value={onboardingStatus}
                      onChange={(e) =>
                        setOnboardingStatus(e.target.value as OnboardingStatus)
                      }
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="NOT_REQUESTED">Not Requested</option>
                      <option value="REQUESTED">Requested</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="DECLINED">Declined</option>
                    </select>
                    <Textarea
                      placeholder="Onboarding notes"
                      value={onboardingNotes}
                      onChange={(e) => setOnboardingNotes(e.target.value)}
                    />
                    <TLButton
                      variant="secondary"
                      onClick={async () => {
                        if (!selectedOrg) return;
                        const res = await updateAdminBusinessOnboarding(
                          selectedOrg.orgId,
                          {
                            status: onboardingStatus,
                            notes: onboardingNotes.trim() || null,
                          },
                        );
                        if (!res.ok) {
                          toast.error("Failed to update onboarding", {
                            description: res.error.message,
                          });
                          return;
                        }
                        toast.success("Onboarding workflow updated");
                        await load();
                      }}
                    >
                      Update Onboarding
                    </TLButton>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </TLSection>
    </div>
  );
}
