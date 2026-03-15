import { apiFetch } from "@/lib/api";

export type ResolvedExperiment = {
  key: string;
  bucket: string;
  config: any;
};

export async function resolveExperiments() {
  return apiFetch<{ items: ResolvedExperiment[] }>(
    "/api/v1/billing/experiments/resolve",
    { method: "GET" },
  );
}
