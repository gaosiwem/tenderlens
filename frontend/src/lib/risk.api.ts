import { apiFetch } from "@/lib/api";

export async function computeWorkspaceRisk(workspaceId: string) {
  return apiFetch<{ riskScore: number; riskMeta: any }>(
    `/api/v1/risk/workspaces/${workspaceId}/compute`,
    { method: "POST" },
  );
}
