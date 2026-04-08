import { apiFetch } from "@/lib/api";

export async function createInvite(email: string, role: "MEMBER" | "VIEWER") {
  return apiFetch<{
    invite: { email: string; role: string; token: string; expiresAt: string };
  }>("/api/v1/orgs/me/invites", {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export async function acceptInvite(token: string) {
  return apiFetch<{ joined: boolean; orgId: string }>(
    `/api/v1/orgs/invites/${token}/accept`,
    { method: "POST" },
  );
}

export async function getInviteInfo(token: string) {
  return apiFetch<{
    token: string;
    email: string;
    role: string;
    expiresAt: string;
    org: { id: string; name: string };
  }>(`/api/v1/orgs/invites/${token}`, {
    method: "GET",
    skipAuthRefresh: true,
  });
}

export async function acceptInviteAnonymous(token: string) {
  return apiFetch<{
    joined: boolean;
    orgId: string;
    provisionalAccountCreated: boolean;
    email: string;
  }>(`/api/v1/orgs/invites/${token}/accept-anonymous`, {
    method: "POST",
    skipAuthRefresh: true,
  });
}
