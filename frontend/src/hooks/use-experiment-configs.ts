"use client";

import * as React from "react";
import { getExperimentConfigs } from "@/lib/experiments-v2.api";
import type { ExperimentV2 } from "@/lib/experiments-v2.api";

export function useExperimentConfigs() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<ExperimentV2[]>([]);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await getExperimentConfigs();
      setLoading(false);
      if (r.ok) setItems(r.data.items);
      else setItems([]);
    })();
  }, []);

  const map = React.useMemo(() => {
    const m: Record<string, { bucket: string; config: any }> = {};
    for (const it of items)
      m[it.key] = { bucket: it.bucket, config: it.config };
    return m;
  }, [items]);

  return { loading, items, map };
}
