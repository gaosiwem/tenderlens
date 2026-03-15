"use client";

import Link from "next/link";
import { TLButton } from "@/components/tenderlens/button";

export function TLEntitlementBanner(props: { warning: any }) {
  const kind = props.warning?.meta?.warningKind ?? "LIMIT";
  const meta = props.warning?.meta ?? {};

  let title = "Approaching your limit";
  let desc = "Upgrade to avoid interruptions.";

  if (kind === "AI_QUERIES_80")
    desc = `AI queries used: ${meta.used} of ${meta.limit}.`;
  if (kind === "AI_QUERIES_100") {
    title = "AI query limit reached";
    desc = `You used ${meta.used} of ${meta.limit}. Upgrade to continue.`;
  }
  if (kind === "SEATS_80")
    desc = `Seats used: ${meta.used} of ${meta.purchased}.`;
  if (kind === "SEATS_100") {
    title = "Seat limit reached";
    desc = `Seats used: ${meta.used} of ${meta.purchased}. Buy more seats.`;
  }

  return (
    <div className="border border-border rounded-2xl p-4 bg-primary/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <div className="font-display text-sm font-extrabold">{title}</div>
        <div className="text-xs text-muted-foreground mt-1">{desc}</div>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/settings/billing">
          <TLButton>Manage billing</TLButton>
        </Link>
        <Link href="/pricing">
          <TLButton variant="secondary">Upgrade</TLButton>
        </Link>
      </div>
    </div>
  );
}
