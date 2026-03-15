import { apiFetch } from "@/lib/api";

export async function generateReferralCode() {
  return apiFetch<{ code: string }>("/api/v1/referrals/generate", {
    method: "POST",
  });
}

export async function getReferralSummary() {
  return apiFetch<{ items: any[] }>("/api/v1/referrals/summary", {
    method: "GET",
  });
}
