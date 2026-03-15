"use client";

import * as React from "react";
import { getChecklist } from "@/lib/onboarding.api";
import { useAuth } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/api";
import type { ChecklistItem } from "@/lib/onboarding.api";

export function useOnboardingChecklist() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<ChecklistItem[]>([]);

  const { isReady } = useAuth();

  async function load() {
    if (!isReady || !getActiveOrgId()) return;
    setLoading(true);
    const r = await getChecklist();
    setLoading(false);
    if (r.ok) setItems(r.data.items);
    else setItems([]);
  }

  React.useEffect(() => {
    if (isReady) {
      load();
    }
  }, [isReady]);

  const completedCount = items.filter((i) => i.completed).length;

  return { loading, items, completedCount, reload: load };
}
