"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { TLCardSkeleton } from "@/components/tenderlens/skeleton-blocks";
import { TLChunkCard } from "@/components/tenderlens/chunk-card";
import { apiFetch } from "@/lib/api";
import type { Tender } from "@/lib/tenders.types";
import type { TenderChunksResponse } from "@/lib/search.types";

export default function ChunksPage() {
  const params = useParams();
  const sp = useSearchParams();
  const tenderId = String(params.tenderId);
  const highlightFromQuery = String(sp.get("q") ?? "");

  const [loading, setLoading] = React.useState(true);
  const [tender, setTender] = React.useState<Tender | null>(null);
  const [chunks, setChunks] = React.useState<TenderChunksResponse["items"]>([]);
  const [filter, setFilter] = React.useState(highlightFromQuery);

  async function load() {
    setLoading(true);

    const t = await apiFetch<Tender>(`/api/v1/tenders/${tenderId}`, {
      method: "GET",
    });
    if (!t.ok) {
      setLoading(false);
      toast.error("Failed to load tender", { description: t.error.message });
      return;
    }

    const c = await apiFetch<TenderChunksResponse>(
      `/api/v1/tenders/${tenderId}/chunks`,
      { method: "GET" },
    );
    setLoading(false);

    setTender(t.data);
    if (!c.ok) {
      setChunks([]);
      toast.error("Failed to load sections", { description: c.error.message });
      return;
    }

    setChunks(c.data.items);
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderId]);

  if (loading && chunks.length === 0) {
    return (
      <TenderLensAppShell title="TenderLens" subtitle="Sections">
        <TLCardSkeleton />
      </TenderLensAppShell>
    );
  }

  const clean = filter.trim().toLowerCase();
  const filtered = !clean
    ? chunks
    : chunks.filter((c) => c.content.toLowerCase().includes(clean));

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Sections">
      <TLSection
        title={tender?.title ? `Sections: ${tender.title}` : "Sections"}
        description="These are the indexed document sections used for semantic search and later AI analysis."
        right={
          <div className="flex items-center gap-2">
            <Link href={`/tenders/${tenderId}`}>
              <TLButton variant="secondary">Back</TLButton>
            </Link>
            <Link href={`/tenders/${tenderId}/insights`}>
              <TLButton variant="secondary">Insights</TLButton>
            </Link>
            <TLButton variant="secondary" onClick={load}>
              Refresh
            </TLButton>
          </div>
        }
      >
        <div className="tl-surface p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-10"
              placeholder="Filter sections by phrase"
            />
            <TLButton variant="secondary" onClick={() => setFilter("")}>
              Clear
            </TLButton>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Showing {filtered.length} of {chunks.length} sections.
          </div>
        </div>

        {chunks.length === 0 ? (
          <TLInlineAlert
            title="No sections found"
            description="Sections are created after processing completes. Confirm the worker is running and embeddings are enabled."
            tone="warning"
          />
        ) : filtered.length === 0 ? (
          <TLInlineAlert
            title="No matches"
            description="Try a shorter phrase."
            tone="neutral"
          />
        ) : (
          <div className="grid gap-4">
            {filtered.map((c) => (
              <TLChunkCard
                key={c.id}
                fileId={c.tenderFileId}
                index={c.index}
                createdAt={c.createdAt}
                content={c.content}
                highlight={filter}
              />
            ))}
          </div>
        )}
      </TLSection>
    </TenderLensAppShell>
  );
}
