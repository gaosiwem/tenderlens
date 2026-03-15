"use client";

import * as React from "react";
import { resolveExperiments } from "@/lib/experiments-resolve.api";

export function useResolvedExperiments() {
  const [loading, setLoading] = React.useState(true);
  const [map, setMap] = React.useState<
    Record<string, { bucket: string; config: any }>
  >({});

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await resolveExperiments();
      setLoading(false);
      if (!r.ok) {
        setMap({});
        return;
      }
      const m: Record<string, any> = {};
      for (const it of (r.data as any).items || []) {
        m[it.key] = { bucket: it.bucket, config: it.config };
      }
      setMap(m);
    })();
  }, []);

  return { loading, map };
}
