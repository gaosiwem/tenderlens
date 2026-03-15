import { apiFetch } from "@/lib/api";
import type { AlertRule, NotificationDelivery } from "./sprint7.types";

// Alerts
export async function listAlertRules() {
  return apiFetch<{ items: AlertRule[] }>("/api/v1/alerts/rules", {
    method: "GET",
  });
}

export async function createAlertRule(payload: {
  name: string;
  eventTypes: string[];
  tenderId?: string;
  keywords: string[];
  cooldownMin: number;
}) {
  return apiFetch<AlertRule>("/api/v1/alerts/rules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAlertRule(
  id: string,
  payload: Partial<{
    name: string;
    isEnabled: boolean;
    eventTypes: string[];
    tenderId: string | null;
    keywords: string[];
    cooldownMin: number;
  }>,
) {
  return apiFetch<AlertRule>(`/api/v1/alerts/rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAlertRule(id: string) {
  return apiFetch<{ deleted: true }>(`/api/v1/alerts/rules/${id}`, {
    method: "DELETE",
  });
}

// Deliveries
export async function listDeliveries(take = 80) {
  return apiFetch<{ items: NotificationDelivery[] }>(
    "/api/v1/notifications/history",
    { method: "GET" },
  );
}
