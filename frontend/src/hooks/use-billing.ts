"use client";

import * as React from "react";
import { getSubscription } from "@/lib/billing.api";
import { useAuth } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/api";
import type { Subscription } from "@/lib/billing.types";

export function useBilling() {
  const [loading, setLoading] = React.useState(true);
  const [subscription, setSubscription] = React.useState<Subscription | null>(
    null,
  );

  const { isReady } = useAuth();

  async function load() {
    if (!isReady || !getActiveOrgId()) return;
    setLoading(true);
    const res = await getSubscription();
    setLoading(false);
    if (res.ok) setSubscription(res.data.subscription);
    else setSubscription(null);
  }

  React.useEffect(() => {
    if (isReady) {
      load();
    }
  }, [isReady]);

  return { loading, subscription, reload: load };
}
