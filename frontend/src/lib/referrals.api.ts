import { apiFetch } from "@/lib/api";

export type ReferralSummaryItem = {
  id: string;
  createdAt: string;
  code: string | null;
  billingReference: string | null;
  status: string | null;
};

export async function generateReferralCode() {
  return apiFetch<{ code: string }>("/api/v1/referrals/generate", {
    method: "POST",
  });
}

export async function getReferralSummary() {
  return apiFetch<{ items: ReferralSummaryItem[] }>("/api/v1/referrals/summary", {
    method: "GET",
  });
}
