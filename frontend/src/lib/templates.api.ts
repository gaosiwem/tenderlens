import { apiFetch } from "@/lib/api";
import type { WatchTemplate } from "./templates.types";

export async function listWatchTemplates() {
  return apiFetch<WatchTemplate[]>("/api/v1/templates", { method: "GET" });
}

export async function applyWatchTemplate(templateId: string) {
  return apiFetch<{ alertRuleId: string; keywords: string[]; addedCount?: number }>(
    "/api/v1/templates/apply",
    {
      method: "POST",
      body: JSON.stringify({ templateId }),
    },
  );
}
