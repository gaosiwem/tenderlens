import { apiFetch } from "./api";

export type SystemSettings = {
  id: string;
  retentionDays: number;
  hideClosedTenders: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export async function getSystemSettings() {
  return apiFetch<SystemSettings>("/api/v1/admin/settings");
}

export async function updateSystemSettings(patch: {
  retentionDays?: number;
  hideClosedTenders?: boolean;
}) {
  return apiFetch<SystemSettings>("/api/v1/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
