import { apiFetch } from "@/lib/api";
import type { TenderDeadlines } from "./deadlines.types";

export async function getTenderDeadlines(tenderId: string) {
  return apiFetch<{ deadlines: TenderDeadlines | null }>(
    `/api/v1/deadlines/tenders/${tenderId}`,
    { method: "GET" },
  );
}

export async function refreshTenderDeadlines(tenderId: string) {
  return apiFetch<{ deadlines: TenderDeadlines | null }>(
    `/api/v1/deadlines/tenders/${tenderId}/refresh`,
    { method: "POST" },
  );
}
