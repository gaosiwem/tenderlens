import { apiFetch } from "@/lib/api";
import type { Subscription, Usage } from "./billing.types";

/**
 * Get the current organization's subscription details.
 */
export async function getSubscription() {
  return apiFetch<{ subscription: Subscription | null }>(
    "/api/v1/billing/subscription",
    {
      method: "GET",
    },
  );
}

/**
 * Get current monthly usage and plan limits.
 */
export async function getUsage() {
  return apiFetch<{ usage: Usage }>("/api/v1/billing/usage", { method: "GET" });
}

/**
 * Start a PayFast checkout session for a specific subscription plan.
 */
export async function startPlanCheckout(
  plan: "PRO" | "BUSINESS",
  quantity: number = 1,
  promoCode?: string,
) {
  return apiFetch<{
    gateway: "PAYFAST";
    paymentUrl: string;
    fields: Record<string, string>;
    reference: string;
  }>("/api/v1/billing/plan-checkout", {
    method: "POST",
    body: JSON.stringify({ plan, quantity, promoCode }),
  });
}
