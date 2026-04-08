"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import {
  getTenderDeadlines,
  refreshTenderDeadlines,
} from "@/lib/deadlines.api";
import type { TenderDeadlines } from "@/lib/deadlines.types";
import { RefreshCw, Zap } from "lucide-react";

function fmt(d: string | null) {
  if (!d) return "Unknown";
  try {
    return new Date(d).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return d;
  }
}

export function TLDeadlinesCard(props: {
  tenderId: string;
  showLink?: boolean;
}) {
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [d, setD] = React.useState<TenderDeadlines | null>(null);

  async function load() {
    setLoading(true);
    const res = await getTenderDeadlines(props.tenderId);
    setLoading(false);
    if (!res.ok) {
      setD(null);
      return;
    }
    setD(res.data.deadlines);
  }

  React.useEffect(() => {
    load();
  }, [props.tenderId]);

  async function refresh() {
    setRefreshing(true);
    const res = await refreshTenderDeadlines(props.tenderId);
    setRefreshing(false);
    if (!res.ok) {
      toast.error("Failed to refresh deadlines", {
        description: res.error.message,
      });
      return;
    }
    setD(res.data.deadlines);
    toast.success("Deadlines refreshed");
  }

  const cited = (d?.citations as any)?.citedChunkIds ?? [];
  const enquiryContacts = (d?.enquiryContacts ?? []).filter(
    (c) => c && (c.name || c.email || c.phone || c.role),
  );

  return (
    <Card className="tl-surface border-border/40 overflow-hidden">
      <CardContent className="p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-display text-sm font-extrabold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Deadlines
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Extracted from tender text using AI. Always confirm in original
              documents before bidding.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TLButton
              variant="secondary"
              size="sm"
              onClick={load}
              loading={loading}
              iconLeft={<RefreshCw className="h-3 w-3" />}
            >
              Refresh
            </TLButton>
            <TLButton size="sm" onClick={refresh} loading={refreshing}>
              {refreshing ? "Extracting..." : "Re-extract"}
            </TLButton>
            {props.showLink ? (
              <Link href={`/tenders/${props.tenderId}/deadlines`}>
                <TLButton variant="secondary" size="sm">
                  Open
                </TLButton>
              </Link>
            ) : null}
          </div>
        </div>

        {!d && !loading ? (
          <TLInlineAlert
            title="No deadlines extracted"
            description="Run re-extract to generate structured dates from the document content."
            tone="warning"
          />
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-1.5 p-3 rounded-xl bg-muted/30 border border-border/20">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              Closing Date
            </div>
            <div className="text-sm font-semibold text-foreground/90">
              {fmt(d?.closingAt ?? null)}
            </div>
          </div>
          <div className="space-y-1.5 p-3 rounded-xl bg-muted/30 border border-border/20">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              Briefing Session
            </div>
            <div className="text-sm font-semibold text-foreground/90">
              {fmt(d?.briefingAt ?? null)}
            </div>
          </div>
          <div className="space-y-1.5 p-3 rounded-xl bg-muted/30 border border-border/20">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              Site Visit
            </div>
            <div className="text-sm font-semibold text-foreground/90">
              {fmt(d?.siteVisitAt ?? null)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              Contact Email
            </div>
            <div className="text-sm font-medium text-foreground/80">
              {d?.contactEmail ?? "Not found"}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              Contact Phone
            </div>
            <div className="text-sm font-medium text-foreground/80">
              {d?.contactPhone ?? "Not found"}
            </div>
          </div>
        </div>

        {enquiryContacts.length > 0 ? (
          <div className="space-y-3 p-3 rounded-xl bg-muted/30 border border-border/20">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              Enquiries Contacts
            </div>
            <div className="space-y-2">
              {enquiryContacts.slice(0, 8).map((contact, idx) => (
                <div
                  key={`${contact.email ?? "no-email"}-${contact.phone ?? "no-phone"}-${idx}`}
                  className="rounded-lg border border-border/30 p-3 text-sm"
                >
                  <div className="font-semibold text-foreground/90">
                    {contact.name ?? "Contact"}
                  </div>
                  <div className="text-muted-foreground">
                    {contact.role ?? "Enquiries"}
                  </div>
                  <div className="mt-1">
                    <div className="break-all">
                      Email: {contact.email ?? "Not found"}
                    </div>
                    <div>Phone: {contact.phone ?? "Not found"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border/40">
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
              Extraction Confidence
            </div>
            <div className="flex items-center gap-2">
              <TLCodeBadge
                value={`${Math.round((d?.confidence ?? 0) * 100)}%`}
              />
              <div className="text-[11px] text-muted-foreground">
                Verification suggested
              </div>
            </div>
          </div>

          {cited.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                Sources
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cited.slice(0, 5).map((id: string) => (
                  <TLCodeBadge
                    key={id}
                    value={id.slice(0, 8)}
                    className="bg-primary/5 border-primary/20 text-primary/80"
                  />
                ))}
                {cited.length > 5 && (
                  <span className="text-[11px] text-muted-foreground">
                    +{cited.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {d?.updatedAt && (
          <div className="text-[10px] text-muted-foreground italic text-right">
            Last analyzed: {new Date(d.updatedAt).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
