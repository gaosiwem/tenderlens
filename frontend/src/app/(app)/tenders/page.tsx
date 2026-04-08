"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, MessagesSquare } from "lucide-react";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLTableShell } from "@/components/tenderlens/table-shell";
import { useAuth } from "@/lib/auth";
import { TLEmptyState } from "@/components/tenderlens/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import type { TenderListItem } from "@/lib/tenders.types";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/date-utils";

type SortField = "title" | "status" | "closingDate" | "companyName";
type SortDirection = "asc" | "desc";
type LifecycleFilter = "open" | "awarded" | "closed" | "cancelled" | "all";

function getDefaultSortDirection(
  lifecycle: LifecycleFilter,
  sortField: SortField,
): SortDirection {
  if (lifecycle === "open" && sortField === "closingDate") return "asc";
  return "desc";
}

function normalizeSortDirection(
  value: string | null,
  lifecycle: LifecycleFilter,
  sortField: SortField,
): SortDirection {
  if (value === "asc" || value === "desc") return value;
  return getDefaultSortDirection(lifecycle, sortField);
}

function normalizeLifecycle(value: string | null): LifecycleFilter {
  if (
    value === "open" ||
    value === "awarded" ||
    value === "closed" ||
    value === "cancelled" ||
    value === "all"
  ) {
    return value;
  }
  return "open";
}

export default function TendersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const lifecycleFromUrl = normalizeLifecycle(searchParams.get("lifecycle"));
    if (
      lifecycleFromUrl !== "awarded" &&
      lifecycleFromUrl !== "closed" &&
      lifecycleFromUrl !== "cancelled"
    ) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("lifecycle");
    const suffix = params.toString();
    const target =
      lifecycleFromUrl === "awarded"
        ? "/awarded"
        : lifecycleFromUrl === "closed"
          ? "/closed"
          : "/cancelled";

    router.replace(suffix ? `${target}?${suffix}` : target);
  }, [router, searchParams]);

  // Initialize state from URL params
  const initialSearch = searchParams.get("search") ?? "";
  const initialPage = Number(searchParams.get("page") ?? "1");
  const initialPageSize = Number(searchParams.get("pageSize") ?? "10");
  const initialLifecycle = normalizeLifecycle(searchParams.get("lifecycle"));
  const initialSortField =
    (searchParams.get("sort") as SortField) ?? "closingDate";
  const initialSortDir = normalizeSortDirection(
    searchParams.get("dir"),
    initialLifecycle,
    initialSortField,
  );

  const [tenders, setTenders] = React.useState<TenderListItem[]>([]);
  const [totalItems, setTotalItems] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [sortField, setSortField] = React.useState<SortField>(initialSortField);
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>(initialSortDir);
  const [lifecycle, setLifecycle] =
    React.useState<LifecycleFilter>(initialLifecycle);
  const [page, setPage] = React.useState(initialPage);
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const { isReady } = useAuth();

  // Helper to sync state to URL
  const syncToUrl = React.useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("includeHistorical");
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "" || value === "ALL") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });
      router.replace(`/tenders?${params.toString()}`);
    },
    [router, searchParams],
  );

  const loadTenders = React.useCallback(async () => {
    if (!isReady) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sort: sortField,
      dir: sortDirection,
    });
    params.set("lifecycle", lifecycle);
    if (debouncedSearch.trim()) {
      params.set("search", debouncedSearch.trim());
    }

    try {
      const res = await apiFetch<{
        items: TenderListItem[];
        page: number;
        pageSize: number;
        total: number;
      }>(`/api/v1/tenders?${params.toString()}`);
      if (!res.ok) {
        setTenders([]);
        setTotalItems(0);
        return;
      }
      setTenders(res.data.items);
      setTotalItems(res.data.total);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    isReady,
    lifecycle,
    page,
    pageSize,
    sortDirection,
    sortField,
  ]);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Keep local state in sync when route query params are changed externally.
  React.useEffect(() => {
    const lifecycleFromUrl = normalizeLifecycle(searchParams.get("lifecycle"));
    if (lifecycleFromUrl !== lifecycle) {
      setLifecycle(lifecycleFromUrl);
      setSortField("closingDate");
      setSortDirection(getDefaultSortDirection(lifecycleFromUrl, "closingDate"));
      setPage(1);
    }
  }, [lifecycle, searchParams]);

  React.useEffect(() => {
    void loadTenders();
  }, [loadTenders]);

  function handleSort(field: SortField) {
    let nextDir: SortDirection = "asc";
    if (sortField === field) {
      nextDir = sortDirection === "asc" ? "desc" : "asc";
    }

    setSortField(field);
    setSortDirection(nextDir);
    syncToUrl({ sort: field, dir: nextDir });
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Sync basic state changes to URL
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    syncToUrl({ search: value, page: 1 });
  };

  const handlePageSizeChange = (value: number) => {
    setPageSize(value);
    setPage(1);
    syncToUrl({ pageSize: value, page: 1 });
  };

  const handlePageChange = (value: number) => {
    const next = Math.max(1, Math.min(totalPages, value));
    setPage(next);
    syncToUrl({ page: next });
  };

  React.useEffect(() => {
    if (page > totalPages && totalItems > 0) {
      setPage(totalPages);
      syncToUrl({ page: totalPages });
    }
  }, [page, syncToUrl, totalItems, totalPages]);

  const pageStart = totalItems === 0 ? 0 : (page - 1) * pageSize;
  const pageItems = tenders;
  const showAmountColumn = lifecycle === "awarded";
  const showChatColumn = lifecycle === "open" || lifecycle === "all";
  const getTenderDetailHref = React.useCallback(
    (t: TenderListItem) => {
      // Respect the explicit lifecycle filter from the current page first.
      // This avoids mis-routing when a row has stale/ambiguous lifecycle metadata.
      if (lifecycle === "awarded") return `/awarded/${t.id}`;
      if (lifecycle === "closed") return `/closed/${t.id}`;
      if (lifecycle === "cancelled") return `/cancelled/${t.id}`;

      const effectiveLifecycle =
        t.lifecycle ?? (lifecycle === "all" ? "open" : lifecycle);

      switch (effectiveLifecycle) {
        case "awarded":
          return `/awarded/${t.id}`;
        case "closed":
          return `/closed/${t.id}`;
        case "cancelled":
          return `/cancelled/${t.id}`;
        default:
          return `/tenders/${t.id}`;
      }
    },
    [lifecycle],
  );

  function SortIcon(props: { field: SortField }) {
    if (sortField !== props.field) {
      return <ArrowUpDown className="size-3.5 text-muted-foreground" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="size-3.5" />
    ) : (
      <ArrowDown className="size-3.5" />
    );
  }

  return (
    <TenderLensAppShell
      title="Tenders"
      description="Manage your tender documents and extraction jobs."
      contentWidth="wide"
    >
      <TLSection>
        <TLTableShell title="All Tenders">
          {!loading && tenders.length === 0 ? (
            <div className="p-6">
              <TLEmptyState
                title="No tenders yet"
                description="No tenders are available in this organization yet."
              />
            </div>
          ) : (
            <>
              <div className="border-b px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <input
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Filter by title or company..."
                    className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Rows per page</span>
                  <select
                    value={pageSize}
                    onChange={(e) =>
                      handlePageSizeChange(Number(e.target.value))
                    }
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              <Table className="table-auto min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className={
                        showAmountColumn
                          ? "w-[48%] min-w-[420px]"
                          : "w-[56%] min-w-[460px]"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("title")}
                        className="inline-flex items-center gap-1.5"
                      >
                        Title
                        <SortIcon field="title" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[170px] min-w-[170px]">
                      <button
                        type="button"
                        onClick={() => handleSort("closingDate")}
                        className="inline-flex items-center gap-1.5"
                      >
                        Closing Date
                        <SortIcon field="closingDate" />
                      </button>
                    </TableHead>
                    <TableHead
                      className={
                        showAmountColumn
                          ? "w-[26%] min-w-[300px]"
                          : "w-[32%] min-w-[320px]"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => handleSort("companyName")}
                        className="inline-flex items-center gap-1.5"
                      >
                        Company
                        <SortIcon field="companyName" />
                      </button>
                    </TableHead>
                    {showAmountColumn ? (
                      <TableHead className="w-[220px] min-w-[220px]">
                        Amount
                      </TableHead>
                    ) : null}
                    {showChatColumn ? (
                      <TableHead className="w-[110px] text-right">
                        Chat
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Skeleton className="h-4 w-48" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          {showAmountColumn ? (
                            <TableCell>
                              <Skeleton className="h-4 w-20" />
                            </TableCell>
                          ) : null}
                          {showChatColumn ? (
                            <TableCell>
                              <Skeleton className="ml-auto h-8 w-20" />
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))
                    : pageItems.map((t) => (
                        <TableRow
                          key={t.id}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="font-medium whitespace-normal align-top">
                            <Link
                              href={getTenderDetailHref(t)}
                              className="block text-xs font-semibold tracking-tight text-foreground/90 hover:text-primary transition-colors break-words"
                            >
                              {t.title}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm align-top">
                            {formatDate(t.closingDate)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-normal align-top">
                            <span className="block leading-snug wrap-break-word">
                              {t.companyName || "-"}
                            </span>
                          </TableCell>
                          {showAmountColumn ? (
                            <TableCell className="text-muted-foreground text-sm align-top whitespace-normal break-words">
                              {t.amount || "-"}
                            </TableCell>
                          ) : null}
                          {showChatColumn ? (
                            <TableCell className="align-top text-right">
                              {(t.lifecycle ?? "open") === "open" ? (
                                <Link href={`/tenders/${t.id}#ai-tender-chat`}>
                                  <TLButton size="sm" variant="outline">
                                    <MessagesSquare className="size-4 mr-1.5" />
                                    Chat
                                  </TLButton>
                                </Link>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  -
                                </span>
                              )}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                  {!loading && pageItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={
                          3 +
                          (showAmountColumn ? 1 : 0) +
                          (showChatColumn ? 1 : 0)
                        }
                        className="py-8 text-center text-muted-foreground"
                      >
                        No tenders match your filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              <div className="border-t px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                  {totalItems === 0
                    ? "No results"
                    : `Showing ${pageStart + 1}-${Math.min(pageStart + pageItems.length, totalItems)} of ${totalItems}`}
                </div>
                <div className="flex items-center gap-2">
                  <TLButton
                    size="sm"
                    variant="outline"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                  >
                    Previous
                  </TLButton>
                  <div className="text-sm text-muted-foreground px-2">
                    Page {page} of {totalPages}
                  </div>
                  <TLButton
                    size="sm"
                    variant="outline"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                  </TLButton>
                </div>
              </div>
            </>
          )}
        </TLTableShell>
      </TLSection>
    </TenderLensAppShell>
  );
}
