import { apiFetch } from "@/lib/api";
import type {
  WatchlistItem,
  WatchlistReminderType,
  WatchlistNotificationChannel,
} from "./watchlist.types";
import type { WatchTemplate } from "./templates.types";

function emitUsageRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("tl:usage-refresh"));
}

export async function listWatchlist() {
  return apiFetch<{ items: WatchlistItem[] }>("/api/v1/watchlist", {
    method: "GET",
  });
}

export async function getWatched(tenderId: string) {
  return apiFetch<{ watched: boolean }>(`/api/v1/watchlist/${tenderId}`, {
    method: "GET",
  });
}

export async function watchTender(tenderId: string, templateId?: string) {
  const res = await apiFetch<{
    item: WatchlistItem;
    template: Pick<WatchTemplate, "id" | "name" | "keywords">;
    alertRuleId: string | null;
  }>(`/api/v1/watchlist/${tenderId}`, {
    method: "POST",
    body: JSON.stringify(templateId ? { templateId } : {}),
  });
  if (res.ok) emitUsageRefresh();
  return res;
}

export async function unwatchTender(tenderId: string) {
  const res = await apiFetch<{ removed: boolean }>(
    `/api/v1/watchlist/${tenderId}`,
    {
      method: "DELETE",
    },
  );
  if (res.ok) emitUsageRefresh();
  return res;
}

export async function bulkUnwatchTenders(tenderIds: string[]) {
  const res = await apiFetch<{ count: number }>("/api/v1/watchlist/bulk-remove", {
    method: "POST",
    body: JSON.stringify({ tenderIds }),
  });
  if (res.ok) emitUsageRefresh();
  return res;
}

export async function updateWatchlistItemPatch(
  tenderId: string,
  patch: {
    notes?: string;
    reminderTypes?: WatchlistReminderType[];
    notificationChannels?: WatchlistNotificationChannel[];
  },
) {
  return apiFetch<WatchlistItem>(`/api/v1/watchlist/${tenderId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function updateWatchlistNotes(tenderId: string, notes?: string) {
  return updateWatchlistItemPatch(tenderId, { notes });
}

export async function updateWatchlistReminders(
  tenderId: string,
  reminderTypes: WatchlistReminderType[],
) {
  return updateWatchlistItemPatch(tenderId, { reminderTypes });
}

export async function updateWatchlistNotificationChannels(
  tenderId: string,
  notificationChannels: WatchlistNotificationChannel[],
) {
  return updateWatchlistItemPatch(tenderId, { notificationChannels });
}
