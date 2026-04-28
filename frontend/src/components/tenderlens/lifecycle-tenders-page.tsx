"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
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
import type {
  TenderAdvancedFilters,
  TenderFilterOptions,
  TenderListItem,
} from "@/lib/tenders.types";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/date-utils";
import {
  emptyTenderAdvancedFilters,
  hasActiveFilters,
  parseTenderAdvancedFilters,
  TenderAdvancedFiltersPanel,
} from "@/components/tenderlens/tender-advanced-filters";

type SortField = "title" | "closingDate" | "companyName";
type SortDirection = "asc" | "desc";
type Lifecycle = "awarded" | "closed" | "cancelled";

const emptyFilterOptions: TenderFilterOptions = {
  categories: [],
  provinces: [],
  organsOfState: [],
  tenderTypes: [],
};

function serializeFilters(filters: TenderAdvancedFilters) {
  return {
    categories: filters.categories.join(","),
    provinces: filters.provinces.join(","),
    organsOfState: filters.organsOfState.join(","),
    tenderNumber: filters.tenderNumber.trim(),
    tenderTypes: filters.tenderTypes.join(","),
    eSubmission: filters.eSubmission,
  };
}

function appendAdvancedFilters(
  params: URLSearchParams,
  filters: TenderAdvancedFilters,
) {
  Object.entries(serializeFilters(filters)).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function parseSortField(value: string | null): SortField {
  if (value === "title" || value === "closingDate" || value === "companyName") {
    return value;
  }
  return "closingDate";
}

function parseSortDirection(value: string | null): SortDirection {
  return value === "asc" || value === "desc" ? value : "desc";
}

type LifecycleTendersPageProps = {
  lifecycle: Lifecycle;
  pageTitle: string;
  description: string;
  tableTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  detailBasePath: "/awarded" | "/closed" | "/cancelled";
  dateColumnLabel: string;
  showAmount?: boolean;
};

export function LifecycleTendersPage(props: LifecycleTendersPageProps) {
  const {
    lifecycle,
    pageTitle,
    description,
    tableTitle,
    emptyTitle,
    emptyDescription,
    detailBasePath,
    dateColumnLabel,
    showAmount = false,
  } = props;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isReady } = useAuth();

  const initialSearch = searchParams.get("search") ?? "";
  const initialPage = parsePositiveInt(searchParams.get("page"), 1);
  const initialPageSize = parsePositiveInt(searchParams.get("pageSize"), 10);
  const initialSortField = parseSortField(searchParams.get("sort"));
  const initialSortDir = parseSortDirection(searchParams.get("dir"));
  const initialAdvancedFilters = parseTenderAdvancedFilters(searchParams);

  const [tenders, setTenders] = React.useState<TenderListItem[]>([]);
  const [totalItems, setTotalItems] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch);
  const [sortField, setSortField] = React.useState<SortField>(initialSortField);
  const [sortDirection, setSortDirection] =
    React.useState<SortDirection>(initialSortDir);
  const [page, setPage] = React.useState(initialPage);
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [advancedFilters, setAdvancedFilters] =
    React.useState<TenderAdvancedFilters>(initialAdvancedFilters);
  const [filterOptions, setFilterOptions] =
    React.useState<TenderFilterOptions>(emptyFilterOptions);

  const syncToUrl = React.useCallback(
    (updates: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const loadTenders = React.useCallback(async () => {
    if (!isReady) return;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      params.set("lifecycle", lifecycle);
      params.set("sort", sortField);
      params.set("dir", sortDirection);
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      appendAdvancedFilters(params, advancedFilters);

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
    advancedFilters,
    debouncedSearch,
    isReady,
    lifecycle,
    page,
    pageSize,
    sortDirection,
    sortField,
  ]);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    void loadTenders();
  }, [loadTenders]);

  React.useEffect(() => {
    if (!isReady) return;
    apiFetch<TenderFilterOptions>("/api/v1/tenders/filters").then((res) => {
      if (res.ok) setFilterOptions(res.data);
    });
  }, [isReady]);

  function handleSort(field: SortField) {
    let nextDir: SortDirection = "asc";
    if (sortField === field) {
      nextDir = sortDirection === "asc" ? "desc" : "asc";
    }

    setSortField(field);
    setSortDirection(nextDir);
    setPage(1);
    syncToUrl({ sort: field, dir: nextDir, page: 1 });
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

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

  const handlePageChange = React.useCallback(
    (value: number) => {
      const next = Math.max(1, Math.min(totalPages, value));
      setPage(next);
      syncToUrl({ page: next });
    },
    [syncToUrl, totalPages],
  );

  const handleAdvancedFiltersChange = (filters: TenderAdvancedFilters) => {
    setAdvancedFilters(filters);
    setPage(1);
    syncToUrl({ ...serializeFilters(filters), page: 1 });
  };

  const handleAdvancedFiltersReset = () => {
    handleAdvancedFiltersChange(emptyTenderAdvancedFilters());
  };

  React.useEffect(() => {
    if (!loading && page > totalPages && totalItems > 0) {
      handlePageChange(totalPages);
    }
  }, [handlePageChange, loading, page, totalItems, totalPages]);

  const pageStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd =
    totalItems === 0 ? 0 : Math.min(pageStart + tenders.length - 1, totalItems);

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
    <TenderLensAppShell title={pageTitle} description={description} contentWidth="wide">
      <TLSection>
        <TLTableShell title={tableTitle}>
          <TenderAdvancedFiltersPanel
            filters={advancedFilters}
            options={filterOptions}
            onChange={handleAdvancedFiltersChange}
            onReset={handleAdvancedFiltersReset}
            leading={
              <input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Filter by title or company..."
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
              />
            }
            trailing={
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
            }
          />

          {!loading && totalItems === 0 ? (
            <div className="p-12 border-t flex flex-col items-center justify-center bg-muted/5">
              <TLEmptyState
                title={search || hasActiveFilters(advancedFilters) ? "No results found" : emptyTitle}
                description={search || hasActiveFilters(advancedFilters) 
                  ? "No tenders match your current search or filters. Try adjusting them to see more results."
                  : emptyDescription}
              />
              {(search || hasActiveFilters(advancedFilters)) && (
                <TLButton 
                  variant="outline" 
                  onClick={handleAdvancedFiltersReset}
                  className="mt-4"
                >
                  Clear all filters
                </TLButton>
              )}
            </div>
          ) : (
            <>
              <div className="px-4 pt-10 pb-1">
                <Table className="table-auto min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className={showAmount ? "w-[48%]" : "w-[56%]"}>
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
                        {dateColumnLabel}
                        <SortIcon field="closingDate" />
                      </button>
                    </TableHead>
                    <TableHead className={showAmount ? "w-[28%]" : "w-[36%]"}>
                      <button
                        type="button"
                        onClick={() => handleSort("companyName")}
                        className="inline-flex items-center gap-1.5"
                      >
                        Company
                        <SortIcon field="companyName" />
                      </button>
                    </TableHead>
                    {showAmount ? (
                      <TableHead className="w-[220px] min-w-[220px]">Amount</TableHead>
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
                          {showAmount ? (
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))
                    : tenders.map((t) => (
                        <TableRow
                          key={t.id}
                          className="cursor-pointer hover:bg-muted/50"
                          role="link"
                          tabIndex={0}
                          onClick={() => {
                            router.push(`${detailBasePath}/${t.id}`);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              router.push(`${detailBasePath}/${t.id}`);
                            }
                          }}
                        >
                          <TableCell className="font-medium whitespace-normal align-top">
                            <Link
                              href={`${detailBasePath}/${t.id}`}
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
                          {showAmount ? (
                            <TableCell className="text-muted-foreground text-sm whitespace-normal align-top">
                              <span className="block leading-snug wrap-break-word">
                                {t.tenderAmount ?? t.amount ?? "-"}
                              </span>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                  {!loading && tenders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={showAmount ? 4 : 3}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No tenders match your filters.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
                </Table>
              </div>
              <div className="border-t px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-muted-foreground">
                  {totalItems === 0
                    ? "No results"
                    : `Showing ${pageStart}-${pageEnd} of ${totalItems}`}
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
                    Page {Math.min(page, totalPages)} of {totalPages}
                  </div>
                  <TLButton
                    size="sm"
                    variant="outline"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages || totalItems === 0}
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
