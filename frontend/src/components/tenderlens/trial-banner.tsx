"use client";

import Link from "next/link";
import { TLButton } from "@/components/tenderlens/button";
import type { Subscription } from "@/lib/billing.types";
import { AlertCircle, Calendar } from "lucide-react";

export function TLTrialBanner(props: { sub: Subscription }) {
  const ends = props.sub.trialEndsAt ? new Date(props.sub.trialEndsAt) : null;
  const isExpired = props.sub.status === "EXPIRED";

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md ${
        isExpired
          ? "border-destructive/30 bg-destructive/5"
          : "border-primary/20 bg-primary/5"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 rounded-full p-2 ${
              isExpired ? "bg-destructive/10" : "bg-primary/10"
            }`}
          >
            {isExpired ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Calendar className="h-4 w-4 text-primary" />
            )}
          </div>
          <div>
            <div className="font-display text-base font-extrabold tracking-tight">
              {isExpired ? "Trial Expired" : "Trial Active"}
            </div>
            <div className="text-sm text-muted-foreground">
              {isExpired
                ? "Upgrade now to continue using our premium workspace and AI tools."
                : `Your 14-day free trial ends on ${ends ? ends.toLocaleDateString() : "soon"}.`}
            </div>
          </div>
        </div>
        <Link href="/pricing" className="shrink-0">
          <TLButton variant={isExpired ? "default" : "secondary"}>
            {isExpired ? "Upgrade Now" : "Compare Plans"}
          </TLButton>
        </Link>
      </div>
    </div>
  );
}
