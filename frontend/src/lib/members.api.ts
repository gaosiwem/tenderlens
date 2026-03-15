import { apiFetch } from "@/lib/api";

export async function setBillingAdmin(userId: string, isBillingAdmin: boolean) {
  return apiFetch<{ ok: true }>(`/api/v1/orgs/me/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ isBillingAdmin }),
  });
}
