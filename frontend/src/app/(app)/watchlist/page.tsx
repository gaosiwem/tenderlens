"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  RefreshCw,
  Trash2,
  Eye,
  Search,
  Filter,
  Calendar,
  ArrowUpDown,
  Building2,
  AlertTriangle,
  Download,
  Check,
  RotateCcw,
  CheckSquare,
  Square,
  FileText,
  Clock,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  listWatchlist,
  unwatchTender,
  bulkUnwatchTenders,
  updateWatchlistNotes,
  updateWatchlistReminders,
  updateWatchlistNotificationChannels,
} from "@/lib/watchlist.api";
import type {
  WatchlistItem,
  WatchlistReminderType,
  WatchlistNotificationChannel,
} from "@/lib/watchlist.types";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export default function WatchlistPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<WatchlistItem[]>([]);
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<
    "dateAdded" | "closingDate" | "title"
  >("closingDate");
  const [filterTemplate, setFilterTemplate] = React.useState<string>("all");

  // pagination state (same pager as /tenders)
  const [page, setPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(10);

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [editingNotesId, setEditingNotesId] = React.useState<string | null>(
    null,
  );

  async function load() {
    setLoading(true);
    const res = await listWatchlist();
    setLoading(false);
    if (!res.ok) {
      toast.error("Failed to load watchlist", {
        description: res.error.message,
      });
      setItems([]);
      return;
    }
    setItems(res.data.items);
  }

  React.useEffect(() => {
    load();
  }, []);

  async function remove(tenderId: string) {
    const res = await unwatchTender(tenderId);
    if (!res.ok) {
      toast.error("Failed to unwatch", { description: res.error.message });
      return;
    }
    toast.info("Removed from watchlist");
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(tenderId);
      return next;
    });
    await load();
  }

  async function bulkRemove() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const res = await bulkUnwatchTenders(ids);
    if (!res.ok) {
      toast.error("Bulk remove failed", { description: res.error.message });
      return;
    }
    toast.info(`Successfully removed ${res.data.count} items`);
    setSelectedIds(new Set());
    await load();
  }

  async function updateNotes(tenderId: string, notes: string) {
    const res = await updateWatchlistNotes(tenderId, notes);
    if (!res.ok) {
      toast.error("Failed to update notes");
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.tenderId === tenderId ? { ...i, notes } : i)),
    );
  }

  async function updateReminders(
    tenderId: string,
    reminderTypes: WatchlistReminderType[],
  ) {
    const res = await updateWatchlistReminders(tenderId, reminderTypes);
    if (!res.ok) {
      toast.error("Failed to update reminders", {
        description: res.error.message,
      });
      return;
    }

    setItems((prev) =>
      prev.map((i) => (i.tenderId === tenderId ? { ...i, reminderTypes } : i)),
    );
  }

  async function updateNotificationChannels(
    tenderId: string,
    notificationChannels: WatchlistNotificationChannel[],
  ) {
    const res = await updateWatchlistNotificationChannels(
      tenderId,
      notificationChannels,
    );
    if (!res.ok) {
      toast.error("Failed to update channels", {
        description: res.error.message,
      });
      return;
    }

    setItems((prev) =>
      prev.map((i) =>
        i.tenderId === tenderId ? { ...i, notificationChannels } : i,
      ),
    );
  }

  function toggleReminder(item: WatchlistItem, type: WatchlistReminderType) {
    const current = new Set(item.reminderTypes ?? []);
    if (current.has(type)) current.delete(type);
    else current.add(type);

    const next = ALL_REMINDER_TYPES.filter((t) => current.has(t));
    void updateReminders(item.tenderId, next);
  }

  function currentChannels(item: WatchlistItem) {
    const selected = (item.notificationChannels ?? []).filter((channel) =>
      ALL_NOTIFICATION_CHANNELS.includes(channel),
    );
    return selected.length > 0
      ? selected
      : (["email"] as WatchlistNotificationChannel[]);
  }

  function toggleNotificationChannel(
    item: WatchlistItem,
    channel: WatchlistNotificationChannel,
  ) {
    const current = new Set(currentChannels(item));
    if (current.has(channel) && current.size === 1) {
      toast.info("Choose at least one channel");
      return;
    }

    if (current.has(channel)) current.delete(channel);
    else current.add(channel);

    const next = ALL_NOTIFICATION_CHANNELS.filter((c) => current.has(c));
    void updateNotificationChannels(item.tenderId, next);
  }

  function handlePageChange(value: number) {
    const next = Math.max(1, Math.min(totalPages, value));
    setPage(next);
  }

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPage(1);
  }

  function exportToCSV() {
    const headers = [
      "Tender Title",
      "Company",
      "Closing Date",
      "Template",
      "Notes",
      "Date Added",
    ];
    const rows = filteredItems.map((i) => [
      i.tenderTitle || "",
      i.companyName || "",
      i.closingDate || "",
      i.templateId || "",
      (i.notes || "").replace(/\n/g, " "),
      new Date(i.createdAt).toLocaleDateString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `watchlist-export-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function toggleSelection(tenderId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tenderId)) next.delete(tenderId);
      else next.add(tenderId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.tenderId)));
    }
  }

  const filteredItems = React.useMemo(() => {
    let result = [...items];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.tenderTitle?.toLowerCase().includes(q) ||
          i.companyName?.toLowerCase().includes(q),
      );
    }

    if (filterTemplate !== "all") {
      result = result.filter((i) => i.templateId === filterTemplate);
    }

    result.sort((a, b) => {
      if (sortBy === "closingDate") {
        const daRaw = a.closingDate
          ? new Date(a.closingDate).getTime()
          : Number.POSITIVE_INFINITY;
        const dbRaw = b.closingDate
          ? new Date(b.closingDate).getTime()
          : Number.POSITIVE_INFINITY;
        const da = Number.isNaN(daRaw) ? Number.POSITIVE_INFINITY : daRaw;
        const db = Number.isNaN(dbRaw) ? Number.POSITIVE_INFINITY : dbRaw;
        return da - db;
      }
      if (sortBy === "title") {
        return (a.tenderTitle || "").localeCompare(b.tenderTitle || "");
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [items, search, sortBy, filterTemplate]);

  // compute pagination derived values
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageItems = filteredItems.slice(pageStart, pageStart + pageSize);

  React.useEffect(() => {
    if (page > totalPages && totalItems > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages, totalItems]);

  const uniqueTemplates = React.useMemo(() => {
    const ts = new Set(items.map((i) => i.templateId));
    return Array.from(ts);
  }, [items]);

  return (
    <TenderLensAppShell
      title="Watchlist"
      subtitle="Monitoring"
      description="Tenders you are actively monitoring for changes, updates, and deadlines."
    >
      <TLSection
        right={
          <div className="flex items-center gap-2">
            <TLButton
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={filteredItems.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </TLButton>
            <TLButton
              variant="secondary"
              size="sm"
              onClick={load}
              loading={loading}
              iconLeft={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </TLButton>
          </div>
        }
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or company..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl w-full"
              />
            </div>
            <TLButton
              variant="outline"
              size="sm"
              onClick={toggleSelectAll}
              className="rounded-xl h-10"
            >
              {selectedIds.size === filteredItems.length &&
              filteredItems.length > 0 ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              {selectedIds.size === filteredItems.length &&
              filteredItems.length > 0
                ? "Deselect All"
                : "Select All"}
            </TLButton>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setPage(1);
                }}
                className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
              >
                <option value="dateAdded">Recently Added</option>
                <option value="closingDate">Closing Date (Soonest)</option>
                <option value="title">Alphabetical</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-xl border border-border/40">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterTemplate}
                onChange={(e) => {
                  setFilterTemplate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All Templates</option>
                {uniqueTemplates.map((t) => (
                  <option key={t} value={t}>
                    {prettyTemplateId(t).replace("Template: ", "")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="relative">
          {filteredItems.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center border-2 border-dashed border-muted-foreground/10 rounded-3xl bg-muted/5">
              <div className="p-6 bg-primary/5 rounded-full mb-6 relative group">
                <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl group-hover:blur-2xl transition-all" />
                <FileText className="h-12 w-12 text-primary relative z-10" />
              </div>
              <h3 className="text-xl font-bold mb-2">
                {search || filterTemplate !== "all"
                  ? "No matching tenders"
                  : "Your watchlist is empty"}
              </h3>
              <p className="text-muted-foreground max-w-sm mb-8">
                {search || filterTemplate !== "all"
                  ? "Adjust your filters or search query to find monitoring items."
                  : "Start following tenders to monitor their deadlines and updates in real-time."}
              </p>
              <TLButton
                onClick={() => router.push("/tenders")}
                variant="outline"
                className="rounded-2xl px-8"
              >
                Browse Tenders
              </TLButton>
            </div>
          ) : (
            <div className="grid gap-2">
              {pageItems.map((i) => {
                const urgency = getUrgency(i.closingDate);
                const isSelected = selectedIds.has(i.tenderId);

                return (
                  <Card
                    key={i.tenderId}
                    className={cn(
                      "tl-surface border-border/40 hover:border-border/80 transition-all duration-300 group overflow-hidden rounded-2xl relative",
                      isSelected &&
                        "ring-2 ring-primary ring-offset-2 bg-primary/5 border-primary/40",
                    )}
                  >
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row h-full">
                        {/* Selection Checkbox */}
                        <div
                          className={cn(
                            "p-2 sm:w-10 flex items-center justify-center cursor-pointer transition-colors border-b sm:border-b-0 sm:border-r border-border/10",
                            isSelected
                              ? "bg-primary/10"
                              : "bg-muted/5 hover:bg-muted/10",
                          )}
                          onClick={() => toggleSelection(i.tenderId)}
                        >
                          <div
                            className={cn(
                              "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all",
                              isSelected
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/30 bg-background",
                            )}
                          >
                            {isSelected && (
                              <Check className="h-3.5 w-3.5 text-primary-foreground stroke-[3px]" />
                            )}
                          </div>
                        </div>

                        <div className="flex-1 p-4 flex flex-col min-w-0">
                          <div className="flex justify-between items-start gap-4 mb-3">
                            <div className="min-w-0 flex-1">
                              <Link
                                href={`/tenders/${i.tenderId}`}
                                className="text-base font-semibold hover:text-primary transition-colors line-clamp-2 leading-tight"
                              >
                                {i.tenderTitle || "Untitled Tender"}
                              </Link>
                              <div className="text-sm text-muted-foreground mt-1 font-medium flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary/60 shrink-0" />
                                <span className="truncate">
                                  {i.companyName || "Unknown Entity"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-2">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>
                                Added{" "}
                                {new Date(i.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {/* Notes Area */}
                          <div className="mt-4 relative">
                            {editingNotesId === i.tenderId ? (
                              <div className="p-4 rounded-xl bg-background border border-primary/20 shadow-lg animate-in fade-in zoom-in duration-200">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="text-[10px] font-bold text-primary flex items-center gap-2">
                                    <FileText className="h-3 w-3" /> Personal
                                    Notes
                                  </label>
                                  <button
                                    className="text-[10px] font-black text-muted-foreground hover:text-primary transition-colors"
                                    onClick={() => setEditingNotesId(null)}
                                  >
                                    Done
                                  </button>
                                </div>
                                <Textarea
                                  autoFocus
                                  placeholder="Insights, internal deadlines, or status..."
                                  className="min-h-[80px] bg-muted/20 border-none focus-visible:ring-0 text-sm resize-none p-3 rounded-lg"
                                  defaultValue={i.notes || ""}
                                  onBlur={(e) => {
                                    updateNotes(i.tenderId, e.target.value);
                                    setEditingNotesId(null);
                                  }}
                                />
                              </div>
                            ) : (
                              <div
                                onClick={() => setEditingNotesId(i.tenderId)}
                                className={cn(
                                  "p-4 rounded-xl border border-transparent transition-all cursor-pointer group/inner-note",
                                  i.notes
                                    ? "bg-primary/5 border-primary/10 hover:border-primary/30"
                                    : "bg-muted/5 hover:bg-muted/10 hover:border-dashed hover:border-muted-foreground/30",
                                )}
                              >
                                {i.notes ? (
                                  <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed italic">
                                    "{i.notes}"
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground/50 font-bold flex items-center gap-2">
                                    <FileText className="h-3 w-3" />
                                    Internal Annotation
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black text-muted-foreground">
                              Reminders
                            </span>
                            {CLOSING_REMINDER_TYPES.map((type) => {
                              const enabled = (i.reminderTypes ?? []).includes(
                                type,
                              );
                              return (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => toggleReminder(i, type)}
                                  className={cn(
                                    "rounded-full border px-3 py-1 text-[10px] font-bold transition-colors",
                                    enabled
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-border/60 bg-muted/10 text-muted-foreground hover:bg-muted/20",
                                  )}
                                >
                                  {REMINDER_LABELS[type]}
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black text-muted-foreground">
                              Notify via
                            </span>
                            {ALL_NOTIFICATION_CHANNELS.map((channel) => {
                              const enabled =
                                currentChannels(i).includes(channel);
                              return (
                                <button
                                  key={channel}
                                  type="button"
                                  onClick={() =>
                                    toggleNotificationChannel(i, channel)
                                  }
                                  className={cn(
                                    "rounded-full border px-3 py-1 text-[10px] font-bold transition-colors inline-flex items-center gap-1.5",
                                    enabled
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-border/60 bg-muted/10 text-muted-foreground hover:bg-muted/20",
                                  )}
                                >
                                  {channel === "email" ? (
                                    <Mail className="h-3 w-3" />
                                  ) : (
                                    <MessageCircle className="h-3 w-3" />
                                  )}
                                  {NOTIFICATION_CHANNEL_LABELS[channel]}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div
                          className={cn(
                            "p-4 sm:w-40 flex flex-col justify-center items-center text-center space-y-1.5 transition-colors",
                            urgency.bg,
                          )}
                        >
                          <div className="text-2xl font-display font-black leading-none tracking-tight">
                            {urgency.label}
                          </div>
                          <div className="text-[10px] font-bold text-muted-foreground/60">
                            {formatClosingDate(i.closingDate)}
                          </div>
                          <div className="flex items-center gap-1 text-[12px] text-muted-foreground/50 font-black pt-1">
                            <Clock className="h-4 w-4" />
                            <span>Deadline</span>
                          </div>
                        </div>

                        <div className="p-2 sm:w-14 flex items-center justify-center bg-muted/5 group-hover:bg-muted/10 transition-colors border-l border-border/10">
                          <button
                            type="button"
                            className="p-3 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all hover:scale-110 active:scale-95"
                            title="Remove from watchlist"
                            onClick={(event) => {
                              event.stopPropagation();
                              void remove(i.tenderId);
                            }}
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* pager similar to /tenders */}
        {totalItems > 0 && (
          <div className="border-t px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              {totalItems === 0
                ? "No results"
                : `Showing ${pageStart + 1}-${Math.min(
                    pageStart + pageItems.length,
                    totalItems,
                  )} of ${totalItems}`}
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
        )}

        {/* Floating Monitoring Control Bar */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-12 duration-500 ease-out">
            <div className="bg-foreground text-background dark:bg-muted dark:text-foreground px-6 py-4 rounded-[2.5rem] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] flex items-center gap-8 backdrop-blur-xl border border-white/10 ring-1 ring-black/5">
              <div className="flex items-center gap-4 pr-8 border-r border-white/20 dark:border-white/10">
                <div className="h-9 w-9 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-display font-black text-sm">
                  {selectedIds.size}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black opacity-60 leading-none">
                    Selected
                  </span>
                  <span className="text-sm font-bold leading-tight">Items</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <TLButton
                  variant="ghost"
                  size="sm"
                  className="rounded-2xl h-11 px-5 font-bold hover:bg-destructive/20 hover:text-destructive transition-all"
                  onClick={bulkRemove}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Selected
                </TLButton>
                <button
                  className="p-2.5 rounded-full hover:bg-white/10 hover:rotate-180 transition-all duration-500"
                  onClick={() => setSelectedIds(new Set())}
                  title="Clear selection"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </TLSection>
    </TenderLensAppShell>
  );
}

const CLOSING_REMINDER_TYPES: WatchlistReminderType[] = [
  "CLOSING_7D",
  "CLOSING_24H",
  "CLOSING_2H",
];

const ALL_REMINDER_TYPES: WatchlistReminderType[] = [
  ...CLOSING_REMINDER_TYPES,
  "BRIEFING_SESSION",
  "SITE_VISIT",
];

const ALL_NOTIFICATION_CHANNELS: WatchlistNotificationChannel[] = [
  "email",
  "whatsapp",
];

const REMINDER_LABELS: Record<WatchlistReminderType, string> = {
  CLOSING_7D: "7d",
  CLOSING_24H: "24h",
  CLOSING_2H: "2h",
  BRIEFING_SESSION: "Briefing",
  SITE_VISIT: "Site visit",
};

const NOTIFICATION_CHANNEL_LABELS: Record<
  WatchlistNotificationChannel,
  string
> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

function prettyTemplateId(templateId: string) {
  if (!templateId) return "No Template";
  if (templateId.startsWith("cat-")) {
    try {
      const hex = templateId.slice(4);
      let str = "";
      for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      }
      return str;
    } catch (e) {
      return templateId;
    }
  }
  return templateId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatClosingDate(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid Date";
  // use full month name for clarity (e.g. "March 5")
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year:
      parsed.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  }).format(parsed);
}

function getUrgency(dateStr: string | null | undefined) {
  if (!dateStr)
    return {
      label: "-",
      color: "gray",
      text: "text-muted-foreground",
      bg: "bg-muted/5",
      icon: null,
    };
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime()))
    return {
      label: "Err",
      color: "red",
      text: "text-destructive",
      bg: "bg-destructive/5",
      icon: <AlertTriangle className="h-4 w-4" />,
    };

  const now = new Date();
  const diffDays = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0)
    return {
      label: "Past",
      color: "gray",
      text: "text-muted-foreground/40",
      bg: "bg-muted/5 opacity-50",
      icon: null,
    };
  if (diffDays <= 2)
    return {
      label: `${diffDays} Days`,
      color: "red",
      text: "text-destructive",
      bg: "bg-destructive/10 animate-pulse",
      icon: <AlertTriangle className="h-4 w-4" />,
    };
  if (diffDays <= 7)
    return {
      label: `${diffDays} Days`,
      color: "orange",
      text: "text-orange-500",
      bg: "bg-orange-500/10",
      icon: <Clock className="h-4 w-4" />,
    };
  return {
    label: `${diffDays} Days`,
    color: "green",
    text: "text-primary",
    bg: "bg-primary/5",
    icon: null,
  };
}
