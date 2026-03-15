"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TenderLensEmptyStateCard } from "@/components/tenderlens/empty-state";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { TLCardSkeleton } from "@/components/tenderlens/skeleton-blocks";
import { apiFetch, getActiveOrgId } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SearchResponse } from "@/lib/search.types";
import { TLResultCard } from "@/components/tenderlens/result-card";
import type { Tender } from "@/lib/tenders.types";

type TenderMap = Record<string, Tender>;

function snippet(s: string, max = 420) {
  const t = (s ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return t.slice(0, max) + "...";
}

export default function SearchPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const initialQ = String(sp.get("q") ?? "");
  const [q, setQ] = React.useState(initialQ);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<SearchResponse | null>(null);
  const [tenderMap, setTenderMap] = React.useState<TenderMap>({});
  const { isReady } = useAuth();

  async function loadTitles() {
    if (!isReady || !getActiveOrgId()) return;
    const res = await apiFetch<{
      items: Tender[];
      page: number;
      pageSize: number;
      total: number;
    }>("/api/v1/tenders?page=1&pageSize=100", { method: "GET" });
    if (!res.ok) return;
    const map: TenderMap = {};
    res.data.items.forEach((t) => (map[t.id] = t));
    setTenderMap(map);
  }

  React.useEffect(() => {
    if (isReady) {
      loadTitles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  async function runSearch(query: string) {
    const clean = query.trim();

    // Update URL to reflect search query
    const params = new URLSearchParams(sp);
    if (clean) {
      params.set("q", clean);
    } else {
      params.delete("q");
    }
    router.replace(`/search?${params.toString()}`);

    if (!clean) {
      setData(null);
      return;
    }

    setLoading(true);
    const res = await apiFetch<SearchResponse>(
      `/api/v1/search?q=${encodeURIComponent(clean)}&limit=12`,
      { method: "GET" },
    );
    setLoading(false);

    if (!res.ok) {
      // Don't toast if it was just a missing orgId race condition (which we handle better now)
      if (res.error.code === "BAD_REQUEST") return;
      toast.error("Search failed", { description: res.error.message });
      setData(null);
      return;
    }

    setData(res.data);
  }

  React.useEffect(() => {
    if (isReady && initialQ.trim()) runSearch(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Search">
      <TLSection
        title="Semantic search"
        description="Search across indexed document sections in the active organization."
      >
        <div className="tl-surface p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch(q);
              }}
              className="h-10"
              placeholder="Example: closing date, mandatory briefing, eligibility requirements"
            />
            <TLButton onClick={() => runSearch(q)} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </TLButton>
            <TLButton
              variant="secondary"
              onClick={() => {
                setQ("");
                setData(null);
                router.replace("/search");
              }}
            >
              Clear
            </TLButton>
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Results appear only after processing completes. If you see nothing,
            check the worker and search configuration.
          </div>
        </div>

        {loading && !data ? <TLCardSkeleton /> : null}

        {!loading && data?.note ? (
          <TLInlineAlert
            title="Search unavailable"
            description={data.note}
            tone="warning"
          />
        ) : null}

        {!loading && data && data.items.length === 0 ? (
          <TenderLensEmptyStateCard
            title="No results"
            description="Try a broader phrase. Also confirm the tender has completed processing and semantic search is enabled."
          />
        ) : null}

        {!loading && data && data.items.length > 0 ? (
          <div className="grid gap-4">
            {data.items.map((hit) => (
              <TLResultCard
                key={hit.id}
                tenderId={hit.tenderId}
                title={tenderMap[hit.tenderId]?.title}
                fileId={hit.tenderFileId}
                chunkIndex={hit.index}
                score={hit.score}
                snippet={snippet(hit.content)}
              />
            ))}
          </div>
        ) : null}
      </TLSection>
    </TenderLensAppShell>
  );
}
