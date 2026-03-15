import { apiFetch } from "@/lib/api";

export type ChecklistItem = {
  key: string;
  title: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
};

export async function getChecklist() {
  return apiFetch<{ items: ChecklistItem[] }>("/api/v1/onboarding/checklist", {
    method: "GET",
  });
}

export async function completeChecklistItem(itemKey: string) {
  return apiFetch<{ completed: true }>(
    `/api/v1/onboarding/checklist/${itemKey}/complete`,
    { method: "POST" },
  );
}
