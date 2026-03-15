import { apiFetch } from "@/lib/api";

export async function getExperiments() {
  return apiFetch<{ items: Array<{ key: string; bucket: string }> }>(
    "/api/v1/billing/experiments/me",
    { method: "GET" },
  );
}
