"use client";

import * as React from "react";
import { getOffers, trackOfferEvent } from "@/lib/offers.api";
import { useAuth } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/api";
import type { UpgradeOffer } from "@/lib/offers.api";

export function useUpgradeOffers() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<UpgradeOffer[]>([]);

  const { isReady } = useAuth();

  async function load() {
    if (!isReady || !getActiveOrgId()) return;
    setLoading(true);
    const r = await getOffers();
    setLoading(false);
    if (r.ok) setItems(r.data.items ?? []);
    else setItems([]);
  }

  React.useEffect(() => {
    if (isReady) {
      load();
    }
  }, [isReady]);

  async function track(offerId: string, name: any, meta?: any) {
    await trackOfferEvent(offerId, name, meta);
  }

  return { loading, items, reload: load, track };
}
