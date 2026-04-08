"use client";

import * as React from "react";
import { toast } from "sonner";
import { Mail, Shield, Search } from "lucide-react";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLBillingAdminToggle } from "@/components/tenderlens/billing-admin-toggle";
import { TLInviteMemberPanel } from "@/components/tenderlens/invite-member-panel";
import { listOrgMembers } from "@/lib/org.api";
import { getSubscription, getUsage } from "@/lib/billing.api";
import type { OrgMember } from "@/lib/org.types";
import type { Subscription, Usage } from "@/lib/billing.types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

export default function MembersPage() {
  const auth = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<OrgMember[]>([]);
  const [search, setSearch] = React.useState("");
  const [subscription, setSubscription] = React.useState<Subscription | null>(
    null,
  );
  const [usage, setUsage] = React.useState<Usage | null>(null);

  async function load() {
    setLoading(true);
    const [membersRes, subRes, usageRes] = await Promise.all([
      listOrgMembers(),
      getSubscription(),
      getUsage(),
    ]);
    setLoading(false);

    if (!membersRes.ok) {
      toast.error("Failed to load members", {
        description: membersRes.error.message,
      });
      setItems([]);
      return;
    }

    setItems(membersRes.data.items);

    if (subRes.ok) {
      setSubscription(subRes.data.subscription);
    }
    if (usageRes.ok) {
      setUsage(usageRes.data.usage);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  const filteredItems = items.filter(
    (m) =>
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const activeOrgId =
    typeof window !== "undefined"
      ? localStorage.getItem("tl_active_org_id")
      : null;
  const currentOrgMembership =
    auth.me?.orgs.find((membership) => membership.org.id === activeOrgId) ??
    auth.me?.orgs[0] ??
    null;
  const userRole = currentOrgMembership?.role ?? null;
  const isAdmin = userRole === "ADMIN" || userRole === "OWNER";
  const maxMembers = usage?.limits?.maxMembers;
  const seatsUsed = subscription?.seatsUsed ?? items.length;
  const seatsPurchased =
    maxMembers === "seats"
      ? (subscription?.seatsPurchased ?? 1)
      : typeof maxMembers === "number"
        ? maxMembers
        : null;

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Settings">
      {/* Invite Panel - Admin Only */}
      {isAdmin ? (
        <TLSection
          title="Invite Members"
          description="Add new team members to your organization."
        >
          <TLInviteMemberPanel onInvited={load} />

          {/* Seat Usage Info */}
          {subscription ? (
            <div className="mt-3 p-3 bg-muted/20 border border-border/50 rounded-xl flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                <strong className="text-foreground">Members:</strong> {seatsUsed}{" "}
                of {seatsPurchased ?? "Unlimited"} used
              </div>
              {seatsPurchased !== null && seatsUsed >= seatsPurchased ? (
                <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  At capacity
                </div>
              ) : null}
            </div>
          ) : null}
        </TLSection>
      ) : null}

      <TLSection
        title="Team Members"
        description="Manage organization roles and specialized billing administration rights."
        right={
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter members..."
              className="pl-9 h-9 text-xs rounded-xl border-border/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        }
      >
        <div className="grid gap-3">
          {loading ? (
            <div className="p-12 text-center border border-border border-dashed rounded-2xl">
              <div className="text-sm text-muted-foreground animate-pulse font-medium uppercase tracking-widest text-[10px]">
                Syncing team data...
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center border border-border border-dashed rounded-2xl">
              <div className="text-sm text-muted-foreground italic">
                No members found.
              </div>
            </div>
          ) : (
            filteredItems.map((m) => (
              <Card
                key={m.userId}
                className="tl-surface border-border/50 overflow-hidden group"
              >
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-primary/20 shrink-0 uppercase">
                      {(m.name || m.email || "?").charAt(0)}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {m.name || "Untitled User"}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground uppercase border border-border/50">
                          {m.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <Mail className="w-3 h-3" />
                        {m.email || "No email provided"}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {m.isBillingAdmin ? (
                          <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-primary bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10 uppercase tracking-tighter">
                            <Shield className="w-2.5 h-2.5" />
                            Billing Access
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <TLBillingAdminToggle
                      userId={m.userId}
                      value={Boolean(m.isBillingAdmin)}
                      onChanged={load}
                      disabled={m.role === "OWNER"}
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="mt-6 flex items-center gap-2 p-4 bg-muted/20 border border-border/50 rounded-2xl">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Billing Admins</strong> can
            manage subscriptions, view invoices, and update payment methods
            without requiring full organization administrator permissions.
          </p>
        </div>
      </TLSection>
    </TenderLensAppShell>
  );
}
