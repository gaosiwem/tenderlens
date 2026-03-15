"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { TLButton } from "@/components/tenderlens/button";
import type { Subscription } from "@/lib/billing.types";

function hoursLeft(graceEndsAt: string | null | undefined) {
  if (!graceEndsAt) return null;
  const ms = new Date(graceEndsAt).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 3600000));
}

export function TLPastDueBanner(props: { sub: Subscription }) {
  if (props.sub.status !== "PAST_DUE") return null;

  const h = hoursLeft(props.sub.graceEndsAt);

  return (
    <div className="relative overflow-hidden border border-red-200/50 rounded-2xl p-4 bg-red-50/50 dark:bg-red-950/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div>
          <div className="font-display text-sm font-extrabold text-red-900 dark:text-red-100">
            Payment Required
          </div>
          <div className="text-xs text-red-700/80 dark:text-red-300/60 mt-0.5 max-w-md">
            Your subscription is past due. To avoid service interruption, please
            update your payment method.
            {h !== null && h > 0 ? (
              <span className="font-semibold text-red-600 dark:text-red-400 ml-1">
                Grace period ends in approximately {h} hours.
              </span>
            ) : h === 0 ? (
              <span className="font-semibold text-red-600 dark:text-red-400 ml-1">
                Grace period has ended.
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link href="/settings/billing">
          <TLButton
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white border-none shadow-sm h-9 px-4"
          >
            Update Payment
          </TLButton>
        </Link>
      </div>
    </div>
  );
}
