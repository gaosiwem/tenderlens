"use client";

import * as React from "react";
import { getUsage } from "@/lib/billing.api";
import { useAuth } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/api";
import type { Usage } from "@/lib/billing.types";

export function useUsage() {
  const [loading, setLoading] = React.useState(true);
  const [usage, setUsage] = React.useState<Usage | null>(null);

  const { isReady } = useAuth();

  async function load() {
    if (!isReady || !getActiveOrgId()) return;
    setLoading(true);
    const res = await getUsage();
    setLoading(false);
    if (res.ok) setUsage(res.data.usage);
    else setUsage(null);
  }

  React.useEffect(() => {
    if (isReady) {
      load();
    }
  }, [isReady]);

  React.useEffect(() => {
    const handleRefresh = () => {
      load();
    };
    window.addEventListener("tl:usage-refresh", handleRefresh);
    return () => {
      window.removeEventListener("tl:usage-refresh", handleRefresh);
    };
  }, [isReady]);

  return { loading, usage, reload: load };
}
