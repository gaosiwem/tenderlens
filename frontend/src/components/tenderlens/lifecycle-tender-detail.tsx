"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  FileText,
  GitCompareArrows,
  History,
  Search,
  Sparkles,
} from "lucide-react";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/date-utils";
import { apiFetch } from "@/lib/api";
import { useBilling } from "@/hooks/use-billing";
import type {
  Tender,
  ScrapedTenderData,
  ExternalTenderDocument,
  TenderLifecycle,
  TenderOutcomeInsights,
  OutcomeInsightAction,
  OutcomeInsightRelatedTender,
} from "@/lib/tenders.types";

type LifecycleTenderDetailProps = {
  tenderId: string;
  lifecycle: Exclude<TenderLifecycle, "open">;
  shellTitle: string;
  detailTitle: string;
  description: string;
  backHref: "/awarded" | "/closed" | "/cancelled";
  backLabel: string;
};

function relatedHref(item: OutcomeInsightRelatedTender) {
  if (item.lifecycle === "awarded") return `/awarded/${item.id}`;
  if (item.lifecycle === "closed") return `/closed/${item.id}`;
  if (item.lifecycle === "cancelled") return `/cancelled/${item.id}`;
  return `/tenders/${item.id}`;
}

function actionIcon(action: OutcomeInsightAction) {
  switch (action.kind) {
    case "open_compare":
      return <GitCompareArrows className="size-4" />;
    case "review_timeline":
      return <History className="size-4" />;
    case "track_reissue":
      return <Search className="size-4" />;
    default:
      return <Sparkles className="size-4" />;
  }
}

export function LifecycleTenderDetail(props: LifecycleTenderDetailProps) {
  const { subscription } = useBilling();
  const isExpiredReadOnly = subscription?.status === "EXPIRED";
  const [loading, setLoading] = React.useState(true);
  const [tender, setTender] = React.useState<Tender | null>(null);
  const [scraped, setScraped] = React.useState<ScrapedTenderData | null>(null);
  const [docs, setDocs] = React.useState<ExternalTenderDocument[]>([]);
  const [insights, setInsights] = React.useState<TenderOutcomeInsights | null>(
    null,
  );

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [tenderRes, scrapedRes, docsRes, insightsRes] = await Promise.all([
          apiFetch<Tender>(`/api/v1/tenders/${props.tenderId}`),
          apiFetch<ScrapedTenderData>(
            `/api/v1/tenders/${props.tenderId}/scraped-data`,
          ),
          apiFetch<{ items: ExternalTenderDocument[] }>(
            `/api/v1/tenders/${props.tenderId}/external-documents`,
          ),
          apiFetch<TenderOutcomeInsights>(
            `/api/v1/tenders/${props.tenderId}/outcome-insights`,
          ),
        ]);

        if (tenderRes.ok) setTender(tenderRes.data);
        if (scrapedRes.ok) setScraped(scrapedRes.data);
        if (docsRes.ok) setDocs(docsRes.data.items);
        if (insightsRes.ok) setInsights(insightsRes.data);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [props.tenderId]);

  function openExternalDocument(path: string) {
    window.open(path, "_blank", "noopener,noreferrer");
  }

  if (loading) {
    return (
      <TenderLensAppShell title={<Skeleton className="h-8 w-64" />}>
        <TLSection>
          <Skeleton className="h-64 w-full" />
        </TLSection>
      </TenderLensAppShell>
    );
  }

  if (!tender) {
    return (
      <TenderLensAppShell title={props.shellTitle}>
        <TLSection>
          <TLInlineAlert title="Not found" variant="error">
            {props.shellTitle} could not be loaded.
          </TLInlineAlert>
        </TLSection>
      </TenderLensAppShell>
    );
  }

  const lifecycleDate = insights?.lifecycleDate ?? null;
  const amount = scraped?.amount ?? tender.amount ?? "-";
  const showDatePrecisionNote =
    insights?.lifecycle === "awarded" &&
    insights.lifecycleDateSource === "import_detected_at";
  const recommendedActions = (insights?.recommendedActions ?? []).filter(
    (action) =>
      !isExpiredReadOnly ||
      (action.kind !== "open_compare" && action.kind !== "open_workspace"),
  );

  return (
    <TenderLensAppShell
      title={props.detailTitle}
      description={props.description}
      showSearch={false}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={props.backHref}>
            <TLButton variant="outline">
              <ArrowLeft className="mr-2 size-4" />
              {props.backLabel}
            </TLButton>
          </Link>
        </div>
      }
    >
      {isExpiredReadOnly ? (
        <TLSection>
          <TLInlineAlert
            title="Read-only history mode"
            description="Your trial has expired. You can still review tender outcomes and documents, but compare and workspace actions are disabled."
          />
        </TLSection>
      ) : null}

      {insights ? (
        <TLSection>
          <TLInlineAlert
            title={`${insights.statusLabel} Intelligence`}
            tone={props.lifecycle === "awarded" ? "success" : "neutral"}
            description={insights.summary}
          />
        </TLSection>
      ) : null}

      <TLSection title="Details">
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
              <div className="text-sm font-semibold tracking-wide text-primary">
                {insights?.lifecycleDateLabel ?? "Relevant Date"}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <div className="text-base font-semibold">
                  {formatDate(lifecycleDate)}
                </div>
              </div>
              {showDatePrecisionNote ? (
                <div className="mt-1 text-sm text-muted-foreground">
                  eTenders does not expose a confirmed award date here. This is the
                  date TenderLens detected the award status.
                </div>
              ) : null}
            </div>

            <div className="min-w-0 w-full text-sm">
              <Link
                href={`/tenders/${tender.id}`}
                className="block rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="text-muted-foreground text-sm tracking-wide">
                  Tender Title
                </div>
                <h1 className="text-base font-bold tracking-tight text-foreground/90 md:text-lg break-words">
                  {tender.title}
                </h1>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-base">
              {props.lifecycle === "awarded" && (
                <div>
                  <div className="text-muted-foreground text-sm tracking-wide">
                    Tender Amount
                  </div>
                  <div>{amount}</div>
                </div>
              )}
              <div>
                <div className="text-muted-foreground text-sm tracking-wide">
                  Tender Number
                </div>
                <div>{scraped?.tenderNumber || "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-sm tracking-wide">
                  {props.lifecycle === "awarded"
                    ? "Awarded Company"
                    : "Procuring Entity"}
                </div>
                <div>{scraped?.companyName || "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-sm tracking-wide">
                  Category
                </div>
                <div>{scraped?.category || "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-sm tracking-wide">
                  Province
                </div>
                <div>{scraped?.province || "-"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-sm tracking-wide">
                  Closing Date
                </div>
                <div>{formatDate(scraped?.closingDate ?? null)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TLSection>

      {insights ? (
        <TLSection title="Outcome Intelligence">
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <Card>
              <CardContent className="pt-6 space-y-5">
                <div>
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Recommended Actions
                  </div>
                  <div className="mt-3 grid gap-3">
                    {recommendedActions.map((action) => (
                      <Link key={action.kind} href={action.href}>
                        <div className="rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:bg-muted/30">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-primary">
                              {actionIcon(action)}
                            </div>
                            <div>
                              <div className="font-semibold">{action.label}</div>
                              <div className="text-sm text-muted-foreground">
                                {action.description}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs tracking-wide text-muted-foreground">
                      Buyer Tenders
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {insights.stats.buyerTenderCount}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs tracking-wide text-muted-foreground">
                      Buyer Awarded
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {insights.stats.buyerAwardedCount}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs tracking-wide text-muted-foreground">
                      Buyer Cancelled
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {insights.stats.buyerCancelledCount}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs tracking-wide text-muted-foreground">
                      Category Tenders
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {insights.stats.categoryTenderCount}
                    </div>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  Outcome intelligence is generated from lifecycle data, buyer/category
                  history, and related tender matching. No automatic AI call runs on
                  page load.
                </div>

                {insights.staleDays !== null && insights.staleDays >= 30 ? (
                  <TLInlineAlert
                    title="Stale Outcome"
                    tone="warning"
                    description={`This tender has been closed for ${insights.staleDays} day(s) without a later lifecycle outcome in TenderLens.`}
                  />
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm font-semibold tracking-wide text-muted-foreground">
                    Similar Tenders
                  </div>
                  <div className="mt-3 space-y-3">
                    {insights.similarTenders.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        No similar tenders found yet.
                      </div>
                    ) : (
                      insights.similarTenders.map((item) => (
                        <Link key={item.id} href={relatedHref(item)}>
                          <div className="rounded-lg border p-3 hover:bg-muted/30">
                            <div className="font-medium leading-snug">{item.title}</div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {item.reason} . {item.companyName || "-"} .{" "}
                              {formatDate(item.closingDate)}
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {(props.lifecycle === "cancelled" || props.lifecycle === "closed") && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm font-semibold tracking-wide text-muted-foreground">
                      Reissue Candidates
                    </div>
                    <div className="mt-3 space-y-3">
                      {insights.reissueCandidates.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No likely republished tender found yet.
                        </div>
                      ) : (
                        insights.reissueCandidates.map((item) => (
                          <Link key={item.id} href={relatedHref(item)}>
                            <div className="rounded-lg border p-3 hover:bg-muted/30">
                              <div className="font-medium leading-snug">{item.title}</div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                {item.reason} . {item.companyName || "-"}
                              </div>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TLSection>
      ) : null}

      <TLSection title="Documents">
        <Card>
          <CardContent className="p-0">
            {docs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No documents available.
              </div>
            ) : (
              <div className="divide-y">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors"
                    role="link"
                    tabIndex={0}
                    onClick={() => openExternalDocument(doc.path)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openExternalDocument(doc.path);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-primary/10 p-2 rounded">
                        <FileText className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{doc.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Source: eTenders
                        </div>
                      </div>
                    </div>
                    <a
                      href={doc.path}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-primary hover:underline shrink-0"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TLSection>
    </TenderLensAppShell>
  );
}
