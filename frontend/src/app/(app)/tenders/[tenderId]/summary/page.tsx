"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Clock3, FileText, Mail, Phone, RefreshCw, User2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { TLCardSkeleton } from "@/components/tenderlens/skeleton-blocks";
import { TLPaywallGuard } from "@/components/tenderlens/paywall-guard";
import { apiFetch } from "@/lib/api";
import { getTenderDeadlines } from "@/lib/deadlines.api";
import type { TenderDeadlines } from "@/lib/deadlines.types";
import { getTenderSummary, refreshTenderSummary } from "@/lib/summaries.api";
import type { TenderSummary } from "@/lib/summaries.types";
import type { Tender } from "@/lib/tenders.types";

type GuardRun = (
  fn: () => Promise<void>,
  meta: { title: string; description: string },
) => Promise<void>;

function getSummaryErrorMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Failed to generate summary. Please try again.";
}

function normalizeSummaryMarkdown(raw: string) {
  const text = (raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return "";
  if (/^#{1,6}\s/m.test(text)) return text;

  const lines = text.split("\n");
  const normalized = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) return trimmed;
    if (/^[A-Z][A-Za-z0-9 /&(),.'-]{3,60}:$/.test(trimmed)) {
      return `### ${trimmed.slice(0, -1)}`;
    }
    return trimmed;
  });

  return normalized.join("\n\n").replace(/\n{3,}/g, "\n\n");
}

function toLocalDateLabel(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
}

const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="mt-10 mb-4 text-xl md:text-2xl font-display font-black tracking-tight border-b border-border/60 pb-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-7 mb-3 text-base md:text-lg font-display font-extrabold tracking-tight">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="leading-7 text-[15px] md:text-base text-foreground/85 mb-4">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 mb-5 space-y-2 marker:text-primary/80">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 mb-5 space-y-2 marker:text-primary/80">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="leading-7 text-[15px] md:text-base text-foreground/85">
      {children}
    </li>
  ),
  hr: () => <hr className="my-8 border-border/60" />,
  strong: ({ children }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
};

export default function TenderSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenderId = params.tenderId as string;
  const forceAutoGenerate = searchParams.get("autogen") === "1";

  const [tender, setTender] = React.useState<Tender | null>(null);
  const [deadlines, setDeadlines] = React.useState<TenderDeadlines | null>(null);
  const [summary, setSummary] = React.useState<TenderSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const guardRunRef = React.useRef<GuardRun | null>(null);
  const autoGenerationKeyRef = React.useRef<string | null>(null);

  const loadDeadlines = React.useCallback(async () => {
    const deadlinesRes = await getTenderDeadlines(tenderId);
    if (deadlinesRes.ok) {
      setDeadlines(deadlinesRes.data.deadlines);
    } else {
      setDeadlines(null);
    }
  }, [tenderId]);

  const loadSummary = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, tenderRes, deadlinesRes] = await Promise.all([
        getTenderSummary(tenderId),
        apiFetch<Tender>(`/api/v1/tenders/${tenderId}`, { method: "GET" }),
        getTenderDeadlines(tenderId),
      ]);

      if (tenderRes.ok) {
        setTender(tenderRes.data);
      } else {
        setTender(null);
      }

      if (deadlinesRes.ok) {
        setDeadlines(deadlinesRes.data.deadlines);
      } else {
        setDeadlines(null);
      }

      if (summaryRes.ok) {
        setSummary(summaryRes.data);
      } else if (summaryRes.error.code === "NOT_FOUND") {
        setSummary(null);
      } else {
        setError(summaryRes.error.message || "Failed to load summary");
      }
    } catch {
      setError("An unexpected error occurred while loading the summary.");
    } finally {
      setLoading(false);
    }
  }, [tenderId]);

  React.useEffect(() => {
    autoGenerationKeyRef.current = null;
  }, [tenderId]);

  React.useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const summaryMarkdown = React.useMemo(
    () => normalizeSummaryMarkdown(summary?.content ?? ""),
    [summary?.content],
  );
  const summaryCoverage = summary?.meta?.coverage;
  const summaryIsStale = Boolean(summary?.meta?.isStale);
  const summaryHasNoDocumentCoverage = Boolean(
    summaryCoverage && summaryCoverage.fileCountIncluded === 0,
  );
  const enquiryContacts = (deadlines?.enquiryContacts ?? []).filter(
    (c) => c && (c.name || c.email || c.phone || c.role),
  );
  const latestExtractLabel = toLocalDateLabel(
    summary?.meta?.latestExtractCreatedAt ?? null,
  );
  const summaryGeneratedLabel = toLocalDateLabel(
    summary?.meta?.summaryCreatedAt ?? summary?.updatedAt ?? summary?.createdAt ?? null,
  );
  const showGeneratingState = !summary && (generating || forceAutoGenerate);

  const generateSummary = React.useCallback(
    async (opts?: { auto?: boolean; clearAutogen?: boolean }) => {
      const auto = opts?.auto ?? false;
      if (generating) return;

      const action = async () => {
        const res = await refreshTenderSummary(tenderId);
        if (!res.ok) throw res.error;
        setSummary(res.data);
        await loadDeadlines();
        setError(null);
        if (!auto) {
          toast.success("Summary refreshed successfully");
        }
      };

      setGenerating(true);
      try {
        const guardRun = guardRunRef.current;
        if (guardRun) {
          await guardRun(action, {
            title: "Summary Requires Pro",
            description:
              "Upgrade to Pro to generate AI-powered executive summaries for your tenders.",
          });
        } else {
          await action();
        }

        if (opts?.clearAutogen) {
          router.replace(`/tenders/${tenderId}/summary`);
        }
      } catch (error: unknown) {
        const message = getSummaryErrorMessage(error);
        setError(message);
        if (!auto) {
          toast.error("Failed to refresh summary", { description: message });
        }
      } finally {
        setGenerating(false);
      }
    },
    [generating, loadDeadlines, router, tenderId],
  );

  React.useEffect(() => {
    if (loading || generating) return;

    if (summary) {
      if (forceAutoGenerate) {
        router.replace(`/tenders/${tenderId}/summary`);
      }
      return;
    }

    const key = `${tenderId}:${forceAutoGenerate ? "force" : "missing"}`;
    if (autoGenerationKeyRef.current === key) return;
    autoGenerationKeyRef.current = key;

    void generateSummary({
      auto: true,
      clearAutogen: forceAutoGenerate,
    });
  }, [
    forceAutoGenerate,
    generateSummary,
    generating,
    loading,
    summary,
    tenderId,
  ]);

  if (loading && !summary && !forceAutoGenerate) {
    return (
      <TenderLensAppShell
        title={tender?.title || "Tender Summary"}
        subtitle="AI Summary"
      >
        <TLCardSkeleton />
      </TenderLensAppShell>
    );
  }

  return (
    <TenderLensAppShell
      title={tender?.title || "Tender Summary"}
      subtitle="AI Summary"
    >
      <TLPaywallGuard>
        {({ run: guardRun }) => {
          guardRunRef.current = guardRun;

          const onRefresh = async () => {
            await generateSummary();
          };

          return (
            <TLSection
              title="Tender Summary"
              description="AI-generated executive summary of the tender documents. Focuses on objective, requirements, and key deadlines."
              right={
                <div className="flex items-center gap-2">
                  <Link href={`/tenders/${tenderId}`}>
                    <TLButton variant="secondary">Back to tender</TLButton>
                  </Link>
                  <TLButton variant="secondary" onClick={onRefresh} loading={generating}>
                    <RefreshCw className="size-4 mr-2" />
                    Refresh
                  </TLButton>
                </div>
              }
            >
              {error ? (
                <TLInlineAlert variant="error" title="Error loading summary">
                  {error}
                </TLInlineAlert>
              ) : null}

              {generating && summary ? (
                <TLInlineAlert variant="info" title="Refreshing summary">
                  The summary is being regenerated from the latest tender data.
                </TLInlineAlert>
              ) : null}

              {summary && summaryIsStale ? (
                <TLInlineAlert variant="warning" title="New document data detected">
                  {latestExtractLabel
                    ? `A document extract updated at ${latestExtractLabel}. Refresh to regenerate this summary from the latest files.`
                    : "A newer document extract is available. Refresh to regenerate this summary from the latest files."}
                </TLInlineAlert>
              ) : null}

              {summary && summaryHasNoDocumentCoverage ? (
                <TLInlineAlert variant="warning" title="No extracted documents used">
                  This summary was generated without extracted document text.
                  Run refresh after document extraction completes.
                </TLInlineAlert>
              ) : null}

              {!summary ? (
                <div className="flex flex-col items-center justify-center border border-border rounded-2xl p-12 bg-background/20">
                  <FileText
                    className={`size-12 text-muted-foreground opacity-20 mb-4 ${showGeneratingState ? "animate-pulse" : ""}`}
                  />
                  <div className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                    {showGeneratingState
                      ? "Generating a detailed summary automatically from the tender content. This may take a few seconds."
                      : "No summary available yet. It will be generated automatically, or you can trigger it now."}
                  </div>
                  {showGeneratingState ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <RefreshCw className="size-4 animate-spin" />
                      Generating summary...
                    </div>
                  ) : (
                    <TLButton onClick={onRefresh} loading={generating}>
                      Generate Summary
                    </TLButton>
                  )}
                </div>
              ) : (
                <div className="grid gap-6">
                  <div className="tl-surface overflow-hidden">
                    <div className="p-6 md:p-10 lg:p-12">
                      <div className="mx-auto max-w-4xl">
                        <ReactMarkdown components={markdownComponents}>
                          {summaryMarkdown}
                        </ReactMarkdown>
                      </div>
                      <div className="mx-auto max-w-4xl mt-12 pt-6 border-t border-border/50 text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <FileText className="size-3.5" />
                        <span>
                          Generated on {summaryGeneratedLabel ?? "Unknown"}
                        </span>
                      </div>
                      {summaryCoverage && summaryCoverage.fileCountIncluded > 0 ? (
                        <div className="mx-auto max-w-4xl mt-3 text-xs text-muted-foreground">
                          Included {summaryCoverage.fileCountIncluded} document
                          {summaryCoverage.fileCountIncluded === 1 ? "" : "s"}
                          {" | "}
                          {summaryCoverage.totalCharsUsed.toLocaleString()} of{" "}
                          {summaryCoverage.totalCharsAvailable.toLocaleString()} extracted
                          characters used
                          {summaryCoverage.truncatedFileCount > 0
                            ? ` | ${summaryCoverage.truncatedFileCount} file${summaryCoverage.truncatedFileCount === 1 ? "" : "s"} truncated for balance`
                            : ""}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="tl-surface p-6 md:p-8">
                    <div className="mx-auto max-w-4xl">
                      <div className="font-display text-lg font-extrabold">
                        Key Dates
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Structured dates extracted for this tender summary.
                      </div>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            <Clock3 className="size-3.5" />
                            Closing Date
                          </div>
                          <div className="mt-3 text-sm font-medium text-foreground/90">
                            {toLocalDateLabel(deadlines?.closingAt) || "Unavailable"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            <Clock3 className="size-3.5" />
                            Briefing Session
                          </div>
                          <div className="mt-3 text-sm font-medium text-foreground/90">
                            {toLocalDateLabel(deadlines?.briefingAt) || "Unavailable"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="tl-surface p-6 md:p-8">
                    <div className="mx-auto max-w-4xl">
                      <div className="font-display text-lg font-extrabold">
                        Contact Details
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Tender contact details captured from extracted tender
                        data.
                      </div>
                      <div className="mt-5 grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            <User2 className="size-3.5" />
                            Contact Person
                          </div>
                          <div className="mt-3 text-sm font-medium text-foreground/90">
                            {deadlines?.contactName || "Unavailable"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            <Mail className="size-3.5" />
                            Email
                          </div>
                          <div className="mt-3 text-sm font-medium text-foreground/90 break-all">
                            {deadlines?.contactEmail || "Unavailable"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            <Phone className="size-3.5" />
                            Phone
                          </div>
                          <div className="mt-3 text-sm font-medium text-foreground/90">
                            {deadlines?.contactPhone || "Unavailable"}
                          </div>
                        </div>
                      </div>
                      {enquiryContacts.length > 0 ? (
                        <div className="mt-6 rounded-xl border border-border/60 bg-background/40 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Enquiries Contacts
                          </div>
                          <div className="mt-3 space-y-3">
                            {enquiryContacts.slice(0, 8).map((contact, idx) => (
                              <div
                                key={`${contact.email ?? "no-email"}-${contact.phone ?? "no-phone"}-${idx}`}
                                className="rounded-lg border border-border/50 p-3 text-sm"
                              >
                                <div className="font-medium text-foreground/95">
                                  {contact.name || "Contact"}
                                </div>
                                <div className="text-muted-foreground mt-1">
                                  {contact.role || "Enquiries"}
                                </div>
                                <div className="mt-2 space-y-1">
                                  <div className="break-all">
                                    Email: {contact.email || "Unavailable"}
                                  </div>
                                  <div>
                                    Phone: {contact.phone || "Unavailable"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </TLSection>
          );
        }}
      </TLPaywallGuard>
    </TenderLensAppShell>
  );
}

