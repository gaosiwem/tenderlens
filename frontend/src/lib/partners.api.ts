import { apiFetch } from "@/lib/api";

export type Partner = {
  id: string;
  name: string;
  email?: string | null;
  active: boolean;
  tier?: { name: string; revenueSharePercent: number } | null;
};

export async function getPartnerMe() {
  return apiFetch<{ partner: Partner | null }>("/api/v1/partners/me", {
    method: "GET",
  });
}

export async function createPartnerReferralCode() {
  return apiFetch<{ code: string }>("/api/v1/partners/referral-code", {
    method: "POST",
  });
}
