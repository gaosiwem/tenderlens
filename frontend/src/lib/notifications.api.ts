import { apiFetch } from "@/lib/api";
import type {
  NotificationEvent,
  NotificationDelivery,
} from "./notifications.types";

export async function listNotificationEvents(take = 50) {
  return apiFetch<{ items: NotificationEvent[] }>(
    `/api/v1/notifications/events?take=${take}`,
    { method: "GET" },
  );
}

export async function listNotificationDeliveries(take = 25) {
  return apiFetch<{ items: NotificationDelivery[] }>(
    `/api/v1/notifications/deliveries?take=${take}`,
    { method: "GET" },
  );
}

export async function listAdminNotificationEvents(take = 100, orgId?: string) {
  const orgFilter = orgId ? `&orgId=${encodeURIComponent(orgId)}` : "";
  return apiFetch<{ items: NotificationEvent[] }>(
    `/api/v1/notifications/admin/events?take=${take}${orgFilter}`,
    { method: "GET" },
  );
}

export async function listAdminNotificationDeliveries(
  take = 100,
  orgId?: string,
  filters?: { status?: string; channel?: string },
) {
  const params = new URLSearchParams({ take: String(take) });
  if (orgId) params.set("orgId", orgId);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.channel) params.set("channel", filters.channel);
  return apiFetch<{ items: NotificationDelivery[] }>(
    `/api/v1/notifications/admin/deliveries?${params.toString()}`,
    { method: "GET" },
  );
}

export async function sendAdminManualNotificationEmail(payload: {
  to: string;
  kind: string;
  tenderTitle?: string;
  companyName?: string;
  reminderType?: string;
  message?: string;
  closingDate?: string;
}) {
  return apiFetch<{
    eventId: string;
    deliveryId: string;
    status: string;
    to: string;
  }>("/api/v1/notifications/admin/manual-send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
