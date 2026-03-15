import { apiFetch } from "@/lib/api";

export type AdminBusinessOrg = {
  orgId: string;
  name: string;
  slug: string;
  createdAt: string;
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    seatsUsed: number;
    seatsPurchased: number;
  } | null;
  membersCount: number;
  supportTicketsCount: number;
  onboardingAssistanceStatus: string;
  onboardingAssistanceRequestedAt: string | null;
  onboardingAssistanceNotes: string | null;
  accountManagerName: string | null;
  accountManagerEmail: string | null;
  supportSlaHours: number;
};

export async function listAdminBusinessOrgs(params?: {
  q?: string;
  onboardingStatus?: string;
  take?: number;
}) {
  const q = params?.q ? `&q=${encodeURIComponent(params.q)}` : "";
  const status = params?.onboardingStatus
    ? `&onboardingStatus=${encodeURIComponent(params.onboardingStatus)}`
    : "";
  const take = Number(params?.take ?? 100);
  return apiFetch<{ items: AdminBusinessOrg[] }>(
    `/api/v1/admin/business/orgs?take=${take}${q}${status}`,
    { method: "GET" },
  );
}

export async function getAdminBusinessAccountManager(orgId: string) {
  return apiFetch<{
    orgId: string;
    name: string | null;
    email: string | null;
    notes: string | null;
    supportSlaHours: number;
  }>(`/api/v1/admin/business/orgs/${orgId}/account-manager`, {
    method: "GET",
  });
}

export async function setAdminBusinessAccountManager(
  orgId: string,
  payload: Partial<{
    name: string | null;
    email: string | null;
    notes: string | null;
    supportSlaHours: number;
  }>,
) {
  return apiFetch<{
    orgId: string;
    name: string | null;
    email: string | null;
    notes: string | null;
    supportSlaHours: number;
  }>(`/api/v1/admin/business/orgs/${orgId}/account-manager`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAdminBusinessOnboarding(
  orgId: string,
  payload: Partial<{
    status:
      | "NOT_REQUESTED"
      | "REQUESTED"
      | "IN_PROGRESS"
      | "COMPLETED"
      | "DECLINED";
    notes: string | null;
  }>,
) {
  return apiFetch<{
    orgId: string;
    status: string;
    requestedAt: string | null;
    notes: string | null;
  }>(`/api/v1/admin/business/orgs/${orgId}/onboarding-assistance`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
