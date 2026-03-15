"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { TLSeatSelector } from "@/components/tenderlens/seat-selector";
import { updateSeats } from "@/lib/in-app-billing.api";
import type { Subscription } from "@/lib/billing.types";

export function TLSeatUpgradeCard(props: {
  sub: Subscription;
  canManageBilling: boolean;
  onUpdated: () => Promise<void> | void;
}) {
  const initial = props.sub.seatsPurchased ?? 1;
  const [seats, setSeats] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!props.canManageBilling) {
      toast.error("Billing admin required");
      return;
    }
    setSaving(true);
    const r = await updateSeats(seats);
    setSaving(false);
    if (!r.ok) {
      toast.error("Update failed", { description: r.error.message });
      return;
    }
    toast.success("Seats updated");
    props.onUpdated();
  }

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-4">
        <div>
          <div className="font-display text-sm font-extrabold">Seats</div>
          <div className="text-xs text-muted-foreground mt-1">
            Purchased: {props.sub.seatsPurchased ?? 1} · Used:{" "}
            {props.sub.seatsUsed ?? 0}
          </div>
        </div>

        <TLSeatSelector value={seats} onChange={setSeats} min={1} max={500} />

        <div className="flex items-center gap-2">
          <TLButton
            onClick={save}
            disabled={saving || !props.canManageBilling}
            loading={saving}
          >
            {saving ? "Updating..." : "Update seats"}
          </TLButton>
          {!props.canManageBilling ? (
            <div className="text-xs text-muted-foreground">
              Only billing admins can change seats.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
