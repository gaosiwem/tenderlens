"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { changePlan } from "@/lib/in-app-billing.api";
import type { Subscription } from "@/lib/billing.types";

export function TLPlanChangeCard(props: {
  sub: Subscription;
  canManageBilling: boolean;
  onUpdated: () => Promise<void> | void;
}) {
  const [plan, setPlan] = React.useState<"PRO" | "BUSINESS">(
    props.sub.plan === "BUSINESS" ? "BUSINESS" : "PRO",
  );
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!props.canManageBilling) {
      toast.error("Billing admin required");
      return;
    }
    if (plan === props.sub.plan) {
      toast.message("No change");
      return;
    }

    setSaving(true);
    const r = await changePlan(plan);
    setSaving(false);

    if (!r.ok) {
      toast.error("Change failed", { description: r.error.message });
      return;
    }
    toast.success("Plan updated");
    props.onUpdated();
  }

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        <div>
          <div className="font-display text-sm font-extrabold">Plan</div>
          <div className="text-xs text-muted-foreground mt-1">
            Current: {props.sub.plan} · Status: {props.sub.status}
          </div>
        </div>

        <select
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
          value={plan}
          onChange={(e) => setPlan(e.target.value as "PRO" | "BUSINESS")}
          disabled={!props.canManageBilling}
        >
          <option value="PRO">PRO</option>
          <option value="BUSINESS">BUSINESS</option>
        </select>

        <div className="flex items-center gap-2">
          <TLButton
            onClick={save}
            disabled={saving || !props.canManageBilling}
            loading={saving}
          >
            {saving ? "Updating..." : "Change plan"}
          </TLButton>
          {!props.canManageBilling ? (
            <div className="text-xs text-muted-foreground">
              Only billing admins can change plans.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
