import { apiFetch } from "@/lib/api";

export type RevenueSummary = {
  windowDays: number;
  activeSubscriptions: number;
  byPlan: Record<string, number>;
  churned: number;
  revenueCents: number;
  mrrEstimateCents: number;
  partnerAttributedUpgrades: number;
};

export async function getRevenueSummary() {
  return apiFetch<RevenueSummary>("/api/v1/admin/revenue/summary", {
    method: "GET",
  });
}
