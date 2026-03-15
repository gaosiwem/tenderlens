import { apiFetch } from "@/lib/api";
import type { NotificationPrefs, PrefsResponse } from "./preferences.types";

export async function getMyPrefs() {
  return apiFetch<PrefsResponse>("/api/v1/preferences/me", {
    method: "GET",
  });
}

export async function updateMyPrefs(patch: Partial<NotificationPrefs>) {
  return apiFetch<{ prefs: NotificationPrefs }>("/api/v1/preferences/me", {
    method: "POST",
    body: JSON.stringify(patch),
  });
}
