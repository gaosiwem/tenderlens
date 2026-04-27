"use client";

import * as React from "react";
import { toast } from "sonner";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  triggerETendersScrapeStream,
  type ScrapeProgressEvent,
} from "@/lib/scraper.api";

export default function AdminScraperPage() {
  const [limit, setLimit] = React.useState("10");
  const [start, setStart] = React.useState("0");
  const [status, setStatus] = React.useState("1");
  const [scrapeAll, setScrapeAll] = React.useState(false);
  const [onlyNew, setOnlyNew] = React.useState(false);
  const [scraping, setScraping] = React.useState(false);
  const [progress, setProgress] = React.useState<ScrapeProgressEvent | null>(
    null,
  );
  const [progressLog, setProgressLog] = React.useState<string[]>([]);
  const streamRef = React.useRef<{ cancel: () => void } | null>(null);
  const statusLabelByCode: Record<number, string> = {
    1: "Open",
    2: "Awarded",
    3: "Closed",
    4: "Cancelled",
  };

  function appendProgressLog(line: string) {
    setProgressLog((prev) => [line, ...prev].slice(0, 10));
  }

  async function handleScrape() {
    const l = scrapeAll ? -1 : Number(limit);
    const s = Number(start);
    const st = Number(status);

    if (isNaN(l) || isNaN(s) || isNaN(st)) {
      toast.error("Invalid parameters. Please enter valid numbers.");
      return;
    }

    setScraping(true);
    setProgress(null);
    setProgressLog([]);
    const toastId = toast.loading(
      scrapeAll ? "Scraping everything..." : "Scraping eTenders...",
    );

    try {
      if (streamRef.current) {
        streamRef.current.cancel();
        streamRef.current = null;
      }

      const stream = triggerETendersScrapeStream({
        limit: l,
        start: s,
        status: st,
        stopOnExisting: onlyNew,
        onStarted: (evt) => {
          setProgress(evt);
          appendProgressLog(
            `Started (${statusLabelByCode[evt.status] ?? `Status ${evt.status}`})`,
          );
        },
        onProgress: (evt) => {
          setProgress(evt);
          appendProgressLog(
            `Processed ${evt.processed} . Imported ${evt.imported} . Skipped ${evt.skipped}`,
          );
        },
      });
      streamRef.current = stream;
      const res = await stream.run();
      streamRef.current = null;

      if (!res.ok) {
        toast.error("Scraping failed", {
          id: toastId,
          description: res.error.message,
        });
        return;
      }

      const data = res.data;
      const message = `Imported: ${data.totalImported}, Skipped: ${data.totalSkipped}${data.stopTriggered ? " (Stopped on duplicates)" : ""}`;
      appendProgressLog(message);

      toast.success("Scraping completed", {
        id: toastId,
        description: message,
      });
    } catch (e: unknown) {
      const description =
        e instanceof Error ? e.message : "Unknown error during scrape";
      toast.error("Error occurred while scraping", {
        id: toastId,
        description,
      });
    } finally {
      setScraping(false);
    }
  }

  function handleCancelScrape() {
    if (!streamRef.current) return;
    streamRef.current.cancel();
    streamRef.current = null;
    setScraping(false);
    appendProgressLog("Scrape canceled by admin.");
    toast.message("Scrape canceled");
  }

  const progressPercent =
    !scrapeAll && Number.isFinite(Number(limit)) && Number(limit) > 0 && progress
      ? Math.min(
          100,
          Math.round((progress.processed / Math.max(1, Number(limit))) * 100),
        )
      : null;

  return (
    <div className="space-y-6">
      <TLSection
        title="Scraper Control"
        description="Trigger the import of new tenders from etenders.gov.za directly."
      >
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="text-sm font-bold">Trigger Scrape Job</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold tracking-wider">
                      Scrape Everything
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Fetch all available records in a single run.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={scrapeAll}
                    onChange={(e) => setScrapeAll(e.target.checked)}
                    className="size-5 accent-primary cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold tracking-wider">
                      Only New Items
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Stop scraping as soon as a duplicate is found.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={onlyNew}
                    onChange={(e) => setOnlyNew(e.target.checked)}
                    className="size-5 accent-primary cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground ">
                    Limit
                  </div>
                  <Input
                    type="number"
                    value={scrapeAll ? "" : limit}
                    disabled={scrapeAll}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder={
                      scrapeAll ? "ALL" : "Number of records to fetch"
                    }
                    min="1"
                  />
                  <div className="text-[10px] text-muted-foreground">
                    {scrapeAll
                      ? "Scraping everything until end of feed"
                      : "Number of records to fetch"}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground ">
                    Start Offset
                  </div>
                  <Input
                    type="number"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    placeholder="Start index"
                    min="0"
                  />
                  <div className="text-[10px] text-muted-foreground">
                    Pagination offset
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground ">
                    Feed Status
                  </div>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="1">Open Tenders</option>
                    <option value="2">Awarded Tenders</option>
                    <option value="3">Closed Tenders</option>
                    <option value="4">Cancelled Tenders</option>
                  </select>
                  <div className="text-[10px] text-muted-foreground">
                    Choose the eTenders dataset to import.
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                <TLButton onClick={handleScrape} disabled={scraping}>
                  {scraping ? "Scraping..." : "Start Scraping"}
                </TLButton>
                {scraping ? (
                  <TLButton variant="outline" onClick={handleCancelScrape}>
                    Cancel
                  </TLButton>
                ) : null}
              </div>

              {progress ? (
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                  <div className="text-xs font-bold tracking-wider">
                    Live Progress
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Imported {progress.imported} . Skipped {progress.skipped} .
                    Processed {progress.processed}
                    {progressPercent !== null
                      ? ` . ${progressPercent}% of requested`
                      : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Offset {progress.currentStart} . Batch {progress.batchSize} .
                    Elapsed {Math.round(progress.elapsedMs / 1000)}s
                  </div>
                </div>
              ) : null}

              {progressLog.length > 0 ? (
                <div className="rounded-xl border border-border bg-background p-3 space-y-1">
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground">
                    Activity Log
                  </div>
                  {progressLog.map((line, i) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      {line}
                    </div>
                  ))}
                </div>
              ) : null}

              <TLInlineAlert
                title="Note on Scraping"
                description="This triggers the backend to asynchronously process eTenders. High limits may take longer to process and generate load on the external system. Only System Administrators can perform this action."
                tone="neutral"
              />
            </CardContent>
          </Card>
        </div>
      </TLSection>
    </div>
  );
}
