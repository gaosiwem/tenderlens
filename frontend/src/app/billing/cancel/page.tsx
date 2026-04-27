"use client";

import * as React from "react";
import Link from "next/link";
import { XCircle } from "lucide-react";
import { TLButton } from "@/components/tenderlens/button";
import { useAuth } from "@/lib/auth";

export default function BillingCancelPage() {
  const auth = useAuth();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const secondaryHref =
    mounted && auth.isAuthed ? "/settings/billing" : "/auth/login";
  const secondaryLabel =
    mounted && auth.isAuthed ? "Open Billing" : "Sign In";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
        <div className="w-full rounded-3xl border border-border bg-card p-8 shadow-sm sm:p-10">
          <div className="mb-8">
            <div className="text-xs font-bold tracking-[0.2em] text-muted-foreground">
              TenderLens
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Payment cancelled
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your PayFast checkout was cancelled before payment was completed.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background p-8 text-center">
            <XCircle className="mx-auto h-12 w-12 text-amber-600" />
            <div className="mt-4 text-lg font-semibold">No payment was taken</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Your current subscription has not been changed.
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/pricing">
              <TLButton>Try Again</TLButton>
            </Link>
            <Link href={secondaryHref}>
              <TLButton variant="secondary">{secondaryLabel}</TLButton>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
