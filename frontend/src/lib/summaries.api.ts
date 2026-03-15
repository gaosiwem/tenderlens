import { apiFetch } from "@/lib/api";
import type { TenderSummary } from "./summaries.types";

export async function getTenderSummary(tenderId: string) {
  return apiFetch<TenderSummary | null>(`/api/v1/summaries/${tenderId}`, {
    method: "GET",
  });
}

export async function refreshTenderSummary(tenderId: string) {
  return apiFetch<TenderSummary | null>(
    `/api/v1/summaries/${tenderId}/refresh`,
    { method: "POST" },
  );
}
