"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, ChevronsUpDown, CalendarDays, Building2 } from "lucide-react";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { runCompare } from "@/lib/compare.api";
import { TLCompareResult } from "@/components/tenderlens/compare-result";
import { TLPaywallGuard } from "@/components/tenderlens/paywall-guard";
import { apiFetch } from "@/lib/api";
import type { TenderListItem } from "@/lib/tenders.types";
import { useUsage } from "@/hooks/use-usage";
import { formatDate } from "@/lib/date-utils";

type PickerTarget = "a" | "b";

function TenderSelectionCard(props: {
  label: string;
  item: TenderListItem | null;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold tracking-wide text-muted-foreground ">
        {props.label}
      </div>
      <button
        type="button"
        onClick={props.onSelect}
        disabled={props.disabled}
        className="flex min-h-28 w-full items-start justify-between rounded-xl border border-border bg-background px-4 py-4 text-left transition hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="min-w-0">
          {props.item ? (
            <div className="space-y-2">
              <div className="font-semibold text-foreground break-words">
                {props.item.title}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="size-3.5" />
                  {props.item.procuringEntityName ||
                    props.item.companyName ||
                    "Unknown buyer"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {formatDate(props.item.closingDate)}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="font-semibold text-foreground">
                Select a tender
              </div>
              <div className="text-sm text-muted-foreground">
                Open a searchable dialog and choose a tender for this side.
              </div>
            </div>
          )}
        </div>
        <span className="ml-4 mt-1 shrink-0 text-muted-foreground">
          <ChevronsUpDown className="size-4" />
        </span>
      </button>
    </div>
  );
}

export default function ComparePage() {
  const [tenderAId, setTenderAId] = React.useState("");
  const [tenderBId, setTenderBId] = React.useState("");
  const [tenderA, setTenderA] = React.useState<TenderListItem | null>(null);
  const [tenderB, setTenderB] = React.useState<TenderListItem | null>(null);
  const [tenderSearch, setTenderSearch] = React.useState("");
  const [debouncedTenderSearch, setDebouncedTenderSearch] = React.useState("");
  const [tenders, setTenders] = React.useState<TenderListItem[]>([]);
  const [loadingTenders, setLoadingTenders] = React.useState(true);
  const [tendersLoadError, setTendersLoadError] = React.useState<string | null>(
    null,
  );
  const [pickerTarget, setPickerTarget] = React.useState<PickerTarget | null>(
    null,
  );
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<unknown>(null);
  const { usage } = useUsage();
  const compareLocked = usage?.limits.compareEnabled === false;
  const pickerOpen = pickerTarget !== null;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTenderSearch(tenderSearch);
    }, 250);
    return () => clearTimeout(timer);
  }, [tenderSearch]);

  React.useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;

    async function loadTenderOptions() {
      setLoadingTenders(true);
      setTendersLoadError(null);
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        sort: "closingDate",
        dir: "desc",
      });
      if (debouncedTenderSearch.trim().length > 0) {
        params.set("search", debouncedTenderSearch.trim());
      }
      const res = await apiFetch<{
        items: TenderListItem[];
        page: number;
        pageSize: number;
        total: number;
      }>(`/api/v1/tenders?${params.toString()}`);

      if (!cancelled) {
        if (!res.ok) {
          setTenders([]);
          setTendersLoadError(res.error.message);
          toast.error("Failed to load tenders", {
            description: res.error.message,
          });
        } else {
          setTenders(res.data.items);
        }
        setLoadingTenders(false);
      }
    }

    void loadTenderOptions();
    return () => {
      cancelled = true;
    };
  }, [debouncedTenderSearch, pickerOpen]);

  function openPicker(target: PickerTarget) {
    setPickerTarget(target);
    setTenderSearch("");
    setDebouncedTenderSearch("");
    setTendersLoadError(null);
  }

  function closePicker(open: boolean) {
    if (open) return;
    setPickerTarget(null);
    setTenderSearch("");
    setDebouncedTenderSearch("");
  }

  function selectTender(item: TenderListItem) {
    if (pickerTarget === "a") {
      setTenderAId(item.id);
      setTenderA(item);
    } else if (pickerTarget === "b") {
      setTenderBId(item.id);
      setTenderB(item);
    }
    setPickerTarget(null);
    setTenderSearch("");
    setDebouncedTenderSearch("");
  }

  const blockedTenderId = pickerTarget === "a" ? tenderBId : tenderAId;

  async function run() {
    if (compareLocked) {
      toast.error("Upgrade plan to access this feature.");
      return;
    }

    const a = tenderAId;
    const b = tenderBId;
    if (!a || !b) {
      toast.error("Select both tenders");
      return;
    }
    if (a === b) {
      toast.error("Select two different tenders");
      return;
    }

    setRunning(true);
    const res = await runCompare(a, b);
    setRunning(false);

    if (!res.ok) {
      const code = res.error.code;
      if (
        code === "PLAN_UPGRADE_REQUIRED" ||
        code === "PLAN_REQUIRED" ||
        code === "USAGE_LIMIT_REACHED" ||
        code === "TRIAL_EXPIRED"
      ) {
        throw res.error;
      }
      toast.error("Compare failed", { description: res.error.message });
      return;
    }
    setResult(res.data.result);
    toast.success("Comparison ready");
  }

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Compare">
      <TLSection
        title="Compare tenders"
        description="Compare requirements, deadlines, risks, and eligibility match using your business documents."
        right={
          <div className="flex items-center gap-2">
            <Link href="/watchlist">
              <TLButton variant="secondary">Watchlist</TLButton>
            </Link>
          </div>
        }
      >
        <div className="grid gap-4">
          {compareLocked ? (
            <Card className="tl-surface border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-display text-sm font-extrabold">
                    Upgrade required for Compare
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Your current plan does not include Compare. Upgrade your
                    plan to interact with this page.
                  </div>
                </div>
                <Link href="/pricing">
                  <TLButton size="sm">Upgrade plan</TLButton>
                </Link>
              </CardContent>
            </Card>
          ) : null}

          <Card className="tl-surface">
            <CardContent className="p-6 space-y-4">
              <div className="font-display text-sm font-extrabold">Inputs</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TenderSelectionCard
                  label="Tender A"
                  item={tenderA}
                  onSelect={() => openPicker("a")}
                  disabled={compareLocked}
                />
                <TenderSelectionCard
                  label="Tender B"
                  item={tenderB}
                  onSelect={() => openPicker("b")}
                  disabled={compareLocked}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Use the picker to search by tender title or buyer, then select
                two different tenders to compare.
              </div>
              <TLPaywallGuard>
                {({ run: guardRun }) => (
                  <TLButton
                    onClick={() =>
                      guardRun(run, {
                        title: "Compare Requires Pro",
                        description:
                          "Upgrade to Pro to compare requirements, deadlines, and risks between tenders.",
                      })
                    }
                    disabled={compareLocked || running}
                  >
                    {running ? "Comparing..." : "Compare"}
                  </TLButton>
                )}
              </TLPaywallGuard>
            </CardContent>
          </Card>

          {result ? <TLCompareResult result={result} /> : null}
        </div>
      </TLSection>

      <Dialog open={pickerOpen} onOpenChange={closePicker}>
        <DialogContent className="gap-0 p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="font-display text-xl font-extrabold tracking-tight">
              {pickerTarget === "a" ? "Select Tender A" : "Select Tender B"}
            </DialogTitle>
            <DialogDescription>
              Search across your tenders and choose one to compare.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={tenderSearch}
                onChange={(e) => setTenderSearch(e.target.value)}
                placeholder="Search by tender title or buyer..."
                className="pl-9"
              />
            </div>

            <div className="rounded-xl border border-border bg-muted/10">
              <div className="max-h-[420px] overflow-y-auto">
                {loadingTenders ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Loading tenders...
                  </div>
                ) : tendersLoadError ? (
                  <div className="px-4 py-10 text-center text-sm text-danger">
                    {tendersLoadError}
                  </div>
                ) : tenders.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No tenders found for this search.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {tenders.map((t) => {
                      const isSelected =
                        (pickerTarget === "a" && t.id === tenderAId) ||
                        (pickerTarget === "b" && t.id === tenderBId);
                      const isBlocked = blockedTenderId === t.id;

                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => selectTender(t)}
                          disabled={isBlocked}
                          className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="font-semibold text-foreground break-words">
                              {t.title}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="size-3.5" />
                                {t.procuringEntityName ||
                                  t.companyName ||
                                  "Unknown buyer"}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="size-3.5" />
                                {formatDate(t.closingDate)}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            {isBlocked ? (
                              <span className="text-xs font-semibold text-muted-foreground">
                                Already selected
                              </span>
                            ) : isSelected ? (
                              <span className="text-xs font-semibold text-primary">
                                Selected
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-primary">
                                Choose
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TenderLensAppShell>
  );
}
