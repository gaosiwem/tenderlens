import { apiFetch } from "@/lib/api";
import type { TenderChangeLog } from "./timeline.types";

export async function getTenderTimeline(tenderId: string, take = 60) {
  return apiFetch<{ items: TenderChangeLog[] }>(
    `/api/v1/tenders/${tenderId}/timeline?take=${take}`,
    { method: "GET" },
  );
}
