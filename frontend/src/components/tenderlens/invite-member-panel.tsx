"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { createInvite } from "@/lib/invites.api";

export function TLInviteMemberPanel(props: {
  onInvited?: () => Promise<void> | void;
}) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"MEMBER" | "VIEWER">("MEMBER");
  const [loading, setLoading] = React.useState(false);
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);

  async function invite() {
    if (!email.trim()) {
      toast.error("Email required");
      return;
    }

    setLoading(true);
    const res = await createInvite(email.trim(), role);
    setLoading(false);

    if (!res.ok) {
      toast.error("Invite failed", { description: res.error.message });
      if (
        res.error.code === "PAYMENT_REQUIRED" ||
        res.error.code === "PLAN_LIMIT_REACHED" ||
        res.error.code === "PLAN_UPGRADE_REQUIRED"
      ) {
        toast.message("Upgrade required", {
          description: "Your current plan has reached the member limit.",
          action: {
            label: "View plans",
            onClick: () => {
              window.location.href = "/pricing";
            },
          },
        });
      }
      return;
    }

    const token = res.data.invite.token;
    const link = `${window.location.origin}/invites/accept/${token}`;
    setInviteLink(link);
    toast.success("Invite created");
    setEmail("");
    props.onInvited?.();
  }

  async function copy() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    toast.success("Invite link copied");
  }

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        <div>
          <div className="font-display text-sm font-extrabold">
            Invite a member
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Member limits are enforced before invite creation and on invite acceptance.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="h-11 md:col-span-2 rounded-xl border border-border bg-background px-3 text-sm"
            placeholder="email@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as "MEMBER" | "VIEWER")}
          >
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <TLButton onClick={invite} disabled={loading}>
            {loading ? "Creating..." : "Create invite"}
          </TLButton>
          {inviteLink ? (
            <TLButton variant="secondary" onClick={copy}>
              Copy link
            </TLButton>
          ) : null}
        </div>

        {inviteLink ? (
          <div className="border border-border rounded-xl p-3 text-sm break-all">
            {inviteLink}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
