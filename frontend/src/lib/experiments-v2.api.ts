import { apiFetch } from "@/lib/api";

export type ExperimentV2 = {
  key: string;
  bucket: string;
  config: any;
};

export async function getExperimentConfigs() {
  return apiFetch<{ items: ExperimentV2[] }>(
    "/api/v1/billing/experiments/config",
    { method: "GET" },
  );
}
