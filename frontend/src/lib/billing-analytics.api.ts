import { apiFetch } from "./api";

export async function trackBillingEvent(name: string, meta?: any) {
  return apiFetch<{ ok: true }>("/api/v1/billing/events", {
    method: "POST",
    body: JSON.stringify({ name, meta }),
  });
}

export async function getBillingEventSummary(days = 14) {
  return apiFetch<{
    items: Array<{ day: string; name: string; count: number }>;
  }>(`/api/v1/billing/events/summary?days=${days}`, { method: "GET" });
}
