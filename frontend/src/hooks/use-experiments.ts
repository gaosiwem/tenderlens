"use client";

import * as React from "react";
import { getExperiments } from "@/lib/experiments.api";

export function useExperiments() {
  const [loading, setLoading] = React.useState(true);
  const [map, setMap] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await getExperiments();
      setLoading(false);
      if (!r.ok) {
        setMap({});
        return;
      }
      const m: Record<string, string> = {};
      for (const it of r.data.items) m[it.key] = it.bucket;
      setMap(m);
    })();
  }, []);

  return { loading, map };
}
