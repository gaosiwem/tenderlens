"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Info, LayoutGrid, RefreshCw, ArrowLeft } from "lucide-react";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { listWatchTemplates } from "@/lib/templates.api";
import type { WatchTemplate } from "@/lib/templates.types";
import { TLTemplateCard } from "@/components/tenderlens/template-card";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";

export default function WatchlistTemplatesPage() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<WatchTemplate[]>([]);

  async function load() {
    setLoading(true);
    const res = await listWatchTemplates();
    setLoading(false);

    if (!res.ok) {
      toast.error("Failed to load templates", {
        description: res.error.message,
      });
      setItems([]);
      return;
    }
    setItems(res.data);
  }

  React.useEffect(() => {
    load();
  }, []);

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Watchlist">
      <div className="space-y-8">
        <TLSection
          title="Watchlist Templates"
          description="Automate your tender discovery by category."
          right={
            <div className="flex items-center gap-2">
              <TLButton variant="secondary" onClick={load} disabled={loading}>
                <RefreshCw
                  className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </TLButton>
            </div>
          }
        >
          <div className="mb-8">
            <TLInlineAlert variant="info" title="How Templates Work">
              <div className="text-sm space-y-2">
                <p>
                  Watchlist templates help you automate the discovery of tenders
                  you care about. When you apply a template:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>
                    <strong>Instant Backfill:</strong> Up to 20 existing tenders
                    matching the category are immediately added to your
                    watchlist.
                  </li>
                  <li>
                    <strong>Real-time Monitoring:</strong> An AI-powered alert
                    rule is created to automatically watch any <em>new</em>{" "}
                    tenders that match this category in the future.
                  </li>
                  <li>
                    <strong>Smart Reminders:</strong> You&apos;ll get automatic
                    notifications for closing dates and briefing sessions for
                    these tenders.
                  </li>
                </ul>
              </div>
            </TLInlineAlert>
          </div>

          {items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((t) => (
                <TLTemplateCard key={t.id} t={t} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center border border-border rounded-2xl p-12 bg-background/20">
              <LayoutGrid className="size-12 text-muted-foreground opacity-20 mb-4" />
              <div className="text-sm text-muted-foreground text-center max-w-sm">
                {loading
                  ? "Discovering tender categories..."
                  : "No categories found in the database yet. Tenders need to be indexed first."}
              </div>
            </div>
          )}
        </TLSection>
      </div>
    </TenderLensAppShell>
  );
}
