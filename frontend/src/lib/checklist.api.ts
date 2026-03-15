import { apiFetch } from "@/lib/api";
import type { BidChecklistDoc } from "./checklist.types";

export async function getChecklist(tenderId: string) {
  return apiFetch<BidChecklistDoc>(`/api/v1/ai/checklist/${tenderId}`, {
    method: "GET",
  });
}

export async function generateChecklist(tenderId: string, force?: boolean) {
  return apiFetch<BidChecklistDoc>(`/api/v1/ai/checklist/${tenderId}`, {
    method: "POST",
    body: JSON.stringify({ force }),
  });
}

export async function updateChecklistItems(
  tenderId: string,
  items: BidChecklistDoc["checklist"],
) {
  return apiFetch<BidChecklistDoc>(`/api/v1/ai/checklist/${tenderId}`, {
    method: "PATCH",
    body: JSON.stringify({ items }),
  });
}
