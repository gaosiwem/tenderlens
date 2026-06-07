import { apiFetch } from "./api";

export async function trackBillingEvent(
  name: string,
  meta?: Record<string, unknown>,
) {
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

export type AdvancedAnalyticsSummary = {
  totalUsers: number;
  activeUsers: number;
  paidUsers: number;
  trialingUsers: number;
  trialExpiredUsers: number;
  totalTrackedEvents: number;
};

export type AdvancedAnalyticsEvent = {
  name: string;
  count: number;
  uniqueUsers: number;
  lastSeenAt: string;
};

export type AdvancedAnalyticsUser = {
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  lifecycle:
    | "PAID"
    | "TRIALING"
    | "TRIAL_EXPIRED"
    | "PAST_DUE"
    | "CANCELED"
    | "NO_SUBSCRIPTION";
  orgCount: number;
  subscriptions: Array<{
    orgId: string;
    orgName: string;
    orgSlug: string;
    plan: string | null;
    status: string | null;
    trialEndsAt: string | null;
    currentPeriodEnd: string | null;
  }>;
  trackedEventCount: number;
  lastActivityAt: string | null;
  topClicks: Array<{ name: string; count: number }>;
};

export type AdvancedAnalyticsActivity = {
  id: string;
  name: string;
  createdAt: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  userId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  meta: unknown;
};

export async function getAdvancedAnalytics(days = 30) {
  return apiFetch<{
    summary: AdvancedAnalyticsSummary;
    eventSummary: AdvancedAnalyticsEvent[];
    users: AdvancedAnalyticsUser[];
    recentActivity: AdvancedAnalyticsActivity[];
  }>(`/api/v1/billing/events/advanced?days=${days}`, { method: "GET" });
}
