"use client";

import * as React from "react";
import { getSubscription } from "@/lib/billing.api";
import { useAuth } from "@/lib/auth";
import { getActiveOrgId, subscribeToActiveOrgId } from "@/lib/api";
import type { Subscription } from "@/lib/billing.types";

export function useBilling() {
  const [loading, setLoading] = React.useState(true);
  const [activeOrgId, setActiveOrgId] = React.useState<string | null>(() =>
    getActiveOrgId(),
  );
  const [subscription, setSubscription] = React.useState<Subscription | null>(
    null,
  );

  const { isReady } = useAuth();

  const load = React.useCallback(async () => {
    if (!isReady) return;
    if (!activeOrgId) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const res = await getSubscription();
    setLoading(false);
    if (res.ok) setSubscription(res.data.subscription);
    else setSubscription(null);
  }, [activeOrgId, isReady]);

  React.useEffect(() => subscribeToActiveOrgId(setActiveOrgId), []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return { loading, subscription, reload: load };
}
