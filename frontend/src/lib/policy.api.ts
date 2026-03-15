import { apiFetch } from "@/lib/api";
import type { OrgBillingPolicy } from "./policy.types";

export async function getBillingPolicy() {
  return apiFetch<OrgBillingPolicy>("/api/v1/billing/policy", {
    method: "GET",
  });
}

export async function updateBillingPolicy(payload: {
  maxChatPerDay: number;
  maxChatCost: number;
}) {
  return apiFetch<OrgBillingPolicy>("/api/v1/billing/policy", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
