import { apiFetch } from "@/lib/api";

export async function markEarningPaid(earningId: string) {
  return apiFetch<{ paid: true }>("/api/v1/referrals/payouts/mark-paid", {
    method: "POST",
    body: JSON.stringify({ earningId }),
  });
}
