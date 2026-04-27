"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { TLButton } from "@/components/tenderlens/button";
import { completeSandboxCheckout, getSubscription } from "@/lib/billing.api";
import type { Subscription } from "@/lib/billing.types";
import { useAuth } from "@/lib/auth";

export default function BillingSuccessPage() {
  const auth = useAuth();
  const [mounted, setMounted] = React.useState(false);
  const [subscription, setSubscription] = React.useState<Subscription | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [polling, setPolling] = React.useState(false);
  const [recovering, setRecovering] = React.useState(false);
  const [recovered, setRecovered] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const confirmed =
    subscription &&
    subscription.status === "ACTIVE" &&
    subscription.plan !== "TRIAL";

  React.useEffect(() => {
    if (!auth.isReady || !auth.isAuthed) return;

    let cancelled = false;
    let attempts = 0;

    async function loadSubscription() {
      setLoading(true);
      const res = await getSubscription();
      if (!cancelled) {
        setLoading(false);
        if (res.ok) setSubscription(res.data.subscription);
      }
    }

    async function poll() {
      setPolling(true);
      while (!cancelled && attempts < 10) {
        attempts += 1;
        await loadSubscription();
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      if (!cancelled) setPolling(false);
    }

    void poll();

    return () => {
      cancelled = true;
    };
  }, [auth.isAuthed, auth.isReady]);

  React.useEffect(() => {
    if (
      !mounted ||
      !auth.isReady ||
      !auth.isAuthed ||
      confirmed ||
      polling ||
      recovering ||
      recovered
    ) {
      return;
    }

    let cancelled = false;

    async function recoverSandboxCheckout() {
      setRecovering(true);
      const recover = await completeSandboxCheckout();
      if (cancelled) return;
      setRecovering(false);
      setRecovered(true);

      if (!recover.ok) return;

      const refreshed = await getSubscription();
      if (!cancelled && refreshed.ok) {
        setSubscription(refreshed.data.subscription);
      }
    }

    void recoverSandboxCheckout();

    return () => {
      cancelled = true;
    };
  }, [
    auth.isAuthed,
    auth.isReady,
    confirmed,
    mounted,
    polling,
    recovered,
    recovering,
  ]);
  const primaryHref =
    mounted && auth.isAuthed ? "/settings/billing" : "/auth/login";
  const primaryLabel =
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
              Payment confirmation
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              PayFast has returned successfully. We are confirming the payment and
              updating the subscription status.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background p-8 text-center">
            {confirmed ? (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                <div className="mt-4 text-lg font-semibold">
                  Subscription activated
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Your plan is active and ready to use.
                </div>
              </>
            ) : auth.isReady && !auth.isAuthed ? (
              <>
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                <div className="mt-4 text-lg font-semibold">Payment received</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Sign in to TenderLens to confirm the updated subscription in your
                  billing page.
                </div>
              </>
            ) : (
              <>
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                <div className="mt-4 text-lg font-semibold">
                  {recovering ? "Finalizing sandbox checkout" : "Waiting for confirmation"}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {recovering
                    ? "TenderLens is completing the local sandbox payment because the webhook callback is not available in this environment."
                    : "We are still waiting for the secure payment confirmation callback."}
                </div>
                {!polling && !loading ? (
                  <div className="mt-3 text-sm text-muted-foreground">
                    If your plan has not updated yet, give it a moment and reopen
                    billing.
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={primaryHref}>
              <TLButton>{primaryLabel}</TLButton>
            </Link>
            <Link href="/pricing">
              <TLButton variant="secondary">Back to Pricing</TLButton>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
