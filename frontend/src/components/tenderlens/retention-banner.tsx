"use client";

import Link from "next/link";
import { TLButton } from "@/components/tenderlens/button";
import { AlertCircle } from "lucide-react";

function copy(kind: string) {
  if (kind === "RETENTION_TRIAL_HIGH_INTENT") {
    return {
      title: "You're close to value",
      desc: "Upgrade to keep collaboration, exports, and AI limits.",
      cta: "/pricing",
      ctaLabel: "Upgrade",
    };
  }
  if (kind === "RETENTION_TRIAL_PAYWALL") {
    return {
      title: "Unlock what you tried to use",
      desc: "You hit a premium feature. Pro removes limits and unlocks exports and workspace.",
      cta: "/pricing",
      ctaLabel: "View plans",
    };
  }
  if (kind === "RETENTION_PRO_LOW_USAGE") {
    return {
      title: "Make Pro pay for itself",
      desc: "Use compare and exports to accelerate decision-making this week.",
      cta: "/tenders",
      ctaLabel: "Browse tenders",
    };
  }
  if (kind === "RETENTION_EXPIRED") {
    return {
      title: "Reactivate access",
      desc: "Your trial ended. Upgrade to keep progress and continue.",
      cta: "/pricing",
      ctaLabel: "Upgrade",
    };
  }
  return {
    title: "Tip",
    desc: "Keep going.",
    cta: "/pricing",
    ctaLabel: "View plans",
  };
}

export function TLRetentionBanner(props: { event: any }) {
  const kind = props.event?.meta?.kind ?? "";
  const c = copy(kind);

  return (
    <div className="border border-border rounded-2xl p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-display text-sm font-extrabold">{c.title}</div>
          <div className="text-xs text-muted-foreground mt-1">{c.desc}</div>
        </div>
      </div>
      <Link href={c.cta}>
        <TLButton>{c.ctaLabel}</TLButton>
      </Link>
    </div>
  );
}
