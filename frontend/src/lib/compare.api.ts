import { apiFetch } from "@/lib/api";
import type { CompareResult } from "./compare.types";

export async function runCompare(tenderAId: string, tenderBId: string) {
  return apiFetch<CompareResult>("/api/v1/ai/compare", {
    method: "POST",
    body: JSON.stringify({ tenderAId, tenderBId }),
  });
}
