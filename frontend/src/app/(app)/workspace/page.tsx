"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  FolderKanbanIcon,
  RefreshCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLEmptyState } from "@/components/tenderlens/empty-state";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { TenderListItem } from "@/lib/tenders.types";
import { formatDate } from "@/lib/date-utils";
import { deleteWorkspace } from "@/lib/workspace.api";

const PAGE_SIZE = 12;

function getDaysUntil(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfTarget = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  return Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / 86400000,
  );
}

function describeClosingWindow(value: string | null | undefined) {
  const days = getDaysUntil(value);
  if (days === null) return "Date pending";
  if (days < 0)
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  return `${days} days left`;
}

function getClosingTone(value: string | null | undefined) {
  const days = getDaysUntil(value);
  if (days === null) return "border-border bg-background text-muted-foreground";
  if (days <= 1) return "border-amber-500/30 bg-amber-500/10 text-amber-700";
  if (days <= 5) return "border-primary/25 bg-primary/10 text-primary";
  return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
}

function WorkspaceMetric(props: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 bg-background/80 shadow-none">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
          {props.icon}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {props.label}
          </div>
          <div className="mt-1 text-xl font-black tracking-tight text-foreground">
            {props.value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{props.hint}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WorkspacePage() {
  const auth = useAuth();
  const activeOrgId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("tl_active_org_id")
      : null;
  const currentOrgRole =
    auth.me?.orgs.find((membership) => membership.org.id === activeOrgId)?.role ??
    null;
  const canDeleteWorkspace =
    currentOrgRole === "OWNER" || currentOrgRole === "ADMIN";

  const [loading, setLoading] = React.useState(true);
  const [tenders, setTenders] = React.useState<TenderListItem[]>([]);
  const [totalItems, setTotalItems] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [deletingTenderId, setDeletingTenderId] = React.useState<string | null>(
    null,
  );

  const load = React.useCallback(async (targetPage = page) => {
    setLoading(true);
    const res = await apiFetch<{
      items: TenderListItem[];
      total: number;
      page: number;
      pageSize: number;
    }>(
      `/api/v1/tenders?page=${targetPage}&pageSize=${PAGE_SIZE}&lifecycle=open&sort=closingDate&dir=asc`,
    );
    setLoading(false);

    if (!res.ok) {
      setTenders([]);
      setTotalItems(0);
      return;
    }

    setTenders(res.data.items);
    setTotalItems(res.data.total);
    setPage(res.data.page);
  }, [page]);

  React.useEffect(() => {
    void load(page);
  }, [load, page]);

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const pageStart = totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd =
    totalItems === 0 ? 0 : Math.min(pageStart + tenders.length - 1, totalItems);
  const nextClosingTender =
    tenders.find((item) => Boolean(item.closingDate)) ?? null;
  const uniqueBuyers = new Set(
    tenders.map((item) => item.companyName?.trim()).filter(Boolean),
  ).size;
  const urgentTenders = tenders.filter((item) => {
    const days = getDaysUntil(item.closingDate);
    return days !== null && days <= 5;
  });

  async function handleDeleteWorkspace(tenderId: string, tenderTitle: string) {
    const confirmed = window.confirm(
      `Delete the workspace for "${tenderTitle}"? This removes its tasks, comments, activity, and attachments.`,
    );
    if (!confirmed) return;

    setDeletingTenderId(tenderId);
    const res = await deleteWorkspace(tenderId);
    setDeletingTenderId(null);

    if (!res.ok) {
      toast.error("Failed to delete workspace", {
        description: res.error.message,
      });
      return;
    }

    if (!res.data.deleted) {
      toast.info("No workspace to delete");
      return;
    }

    toast.success("Workspace deleted");

    const nextPage =
      tenders.length === 1 && page > 1 ? Math.max(1, page - 1) : page;
    await load(nextPage);
  }

  return (
    <TenderLensAppShell
      title="TenderLens"
      subtitle="Workspaces"
      description="Choose a tender workspace, then coordinate tasks, assignees, comments, and supporting documents from one place."
      actions={
        <TLButton
          variant="secondary"
          size="sm"
          onClick={() => void load(page)}
          loading={loading}
          iconLeft={<RefreshCcwIcon size={14} />}
        >
          Refresh
        </TLButton>
      }
    >
      <TLSection>
        <Card className="overflow-hidden border-primary/15 bg-[radial-gradient(circle_at_top_left,_rgba(203,213,225,0.35),_transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] shadow-sm">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.7fr] lg:p-8">
            <div className="space-y-5">
              <TLCodeBadge
                value="Tender-scoped collaboration"
                className="border-primary/20 bg-primary/10 text-primary"
              />
              <div className="max-w-3xl">
                <div className="font-display text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                  Open the right workspace fast and keep every bid team in its own lane.
                </div>
                <div className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Each workspace belongs to a single tender. Start from the list
                  below to jump into task planning, assignment, commentary, and
                  supporting attachments without losing tender context.
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-white/80 p-5 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                Next workspace to action
              </div>
              <div className="mt-3 text-sm font-semibold text-foreground">
                {nextClosingTender?.title ?? "No open tenders available"}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {nextClosingTender
                  ? `${nextClosingTender.companyName || "Unknown buyer"} . ${describeClosingWindow(nextClosingTender.closingDate)}`
                  : "When open tenders are available, the nearest closing workspace will appear here."}
              </div>
              {nextClosingTender ? (
                <div className="mt-4">
                  <Link href={`/tenders/${nextClosingTender.id}/workspace`}>
                    <TLButton size="sm" iconLeft={<FolderKanbanIcon size={15} />}>
                      Open Priority Workspace
                    </TLButton>
                  </Link>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </TLSection>

      <TLSection>
        <div className="grid gap-4 md:grid-cols-3">
          <WorkspaceMetric
            label="Visible"
            value={String(tenders.length)}
            hint="Tenders shown on the current page."
            icon={<FolderKanbanIcon size={18} />}
          />
          <WorkspaceMetric
            label="Urgent"
            value={String(urgentTenders.length)}
            hint="Current-page tenders closing within five days."
            icon={<BriefcaseBusinessIcon size={18} />}
          />
          <WorkspaceMetric
            label="Buyers"
            value={String(uniqueBuyers)}
            hint="Distinct procuring entities on this page."
            icon={<Building2Icon size={18} />}
          />
        </div>
      </TLSection>

      <TLSection
        title="Workspace List"
        description="Pick a tender to enter its dedicated workspace."
        right={
          <div className="text-xs text-muted-foreground">
            {totalItems === 0
              ? "No workspaces to show"
              : `Showing ${pageStart}-${pageEnd} of ${totalItems}`}
          </div>
        }
      >
        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-5 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {!loading && tenders.length === 0 ? (
          <TLEmptyState
            title="No tender workspaces available"
            description="No open tenders were found for the active organization."
            action={
              <Link href="/tenders">
                <TLButton>Go to Tenders</TLButton>
              </Link>
            }
          />
        ) : null}

        {!loading ? (
          <div className="grid gap-4">
            {tenders.map((tender, index) => (
              <Card
                key={tender.id}
                className="group overflow-hidden border-border/60 bg-background/90 shadow-none transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
              >
                <CardContent className="grid gap-5 p-5 lg:grid-cols-[72px_minmax(0,1fr)_auto] lg:items-center">
                  <div className="flex items-center gap-3 lg:block">
                    <div className="inline-flex size-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 font-display text-lg font-black text-primary">
                      {String((page - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}
                    </div>
                    <div className="lg:mt-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        Queue position
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Sorted by nearest closing date
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <TLCodeBadge
                        value={describeClosingWindow(tender.closingDate)}
                        className={getClosingTone(tender.closingDate)}
                      />
                      {tender.companyName ? (
                        <TLCodeBadge value={tender.companyName} />
                      ) : null}
                    </div>

                    <div className="mt-3 text-base font-black tracking-tight text-foreground sm:text-lg">
                      {tender.title}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                      <div>
                        <span className="font-semibold text-foreground">
                          Closing:
                        </span>{" "}
                        {formatDate(tender.closingDate)}
                      </div>
                      <div>
                        <span className="font-semibold text-foreground">
                          Tender:
                        </span>{" "}
                        {tender.id.slice(0, 8)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    <Link href={`/tenders/${tender.id}/workspace`}>
                      <TLButton size="sm" rightIcon={<ArrowRightIcon size={14} />}>
                        Open Workspace
                      </TLButton>
                    </Link>
                    {canDeleteWorkspace ? (
                      <TLButton
                        size="sm"
                        variant="outline"
                        iconLeft={<Trash2Icon size={14} />}
                        loading={deletingTenderId === tender.id}
                        onClick={() =>
                          void handleDeleteWorkspace(tender.id, tender.title)
                        }
                      >
                        Delete Workspace
                      </TLButton>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {!loading && totalPages > 1 ? (
          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <TLButton
                variant="outline"
                size="sm"
                disabled={page <= 1}
                iconLeft={<ArrowLeftIcon size={14} />}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </TLButton>
              <TLButton
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                rightIcon={<ArrowRightIcon size={14} />}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Next
              </TLButton>
            </div>
          </div>
        ) : null}
      </TLSection>
    </TenderLensAppShell>
  );
}
