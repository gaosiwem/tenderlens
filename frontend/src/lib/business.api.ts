import { apiFetch } from "@/lib/api";
import type {
  BusinessAnalytics,
  BusinessCustomLimits,
  BusinessProfile,
  IntegrationEndpoint,
  SupportTicket,
  WorkspaceTemplate,
} from "./business.types";

export async function getBusinessProfile() {
  return apiFetch<{ profile: BusinessProfile; customLimits: BusinessCustomLimits }>(
    "/api/v1/business/profile",
    { method: "GET" },
  );
}

export async function updateBusinessProfile(
  payload: Partial<{
    alertAutomationEnabled: boolean;
    alertDefaultChannels: ("email" | "whatsapp")[];
    alertEscalationEnabled: boolean;
    alertEscalationMinutes: number;
    alertEscalationChannels: ("email" | "whatsapp")[];
    taskGovernanceEnabled: boolean;
    requireTaskOwner: boolean;
    requireTaskDueDate: boolean;
    blockTaskCloseWithoutAssignee: boolean;
    blockTaskCloseWithoutDueDate: boolean;
    supportSlaHours: number;
  }>,
) {
  return apiFetch<BusinessProfile>("/api/v1/business/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBusinessCustomLimits(
  payload: Partial<{
    maxAiQueries: number | null;
    maxWatchlist: number | null;
    maxMembers: number | null;
    exportsEnabled: boolean | null;
    workspaceEnabled: boolean | null;
    compareEnabled: boolean | null;
    whatsappEnabled: boolean | null;
    riskEnabled: boolean | null;
  }>,
) {
  return apiFetch<BusinessCustomLimits>("/api/v1/business/custom-limits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getBusinessAnalytics() {
  return apiFetch<{ analytics: BusinessAnalytics }>("/api/v1/business/analytics", {
    method: "GET",
  });
}

export async function listWorkspaceTemplates() {
  return apiFetch<{ items: WorkspaceTemplate[] }>("/api/v1/business/templates", {
    method: "GET",
  });
}

export async function createWorkspaceTemplate(payload: {
  name: string;
  description?: string | null;
  isDefault?: boolean;
  tasks?: Array<{
    title: string;
    description?: string | null;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    tags?: string[];
    dueInDays?: number | null;
    sortOrder?: number;
  }>;
}) {
  return apiFetch<WorkspaceTemplate>("/api/v1/business/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateWorkspaceTemplate(
  id: string,
  payload: Partial<{
    name: string;
    description: string | null;
    isDefault: boolean;
    tasks: Array<{
      title: string;
      description?: string | null;
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      tags?: string[];
      dueInDays?: number | null;
      sortOrder?: number;
    }>;
  }>,
) {
  return apiFetch<WorkspaceTemplate>(`/api/v1/business/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteWorkspaceTemplate(id: string) {
  return apiFetch<{ deleted: true }>(`/api/v1/business/templates/${id}`, {
    method: "DELETE",
  });
}

export async function applyWorkspaceTemplate(id: string, tenderId: string) {
  return apiFetch<{ created: number; workspaceId: string }>(
    `/api/v1/business/templates/${id}/apply/${tenderId}`,
    { method: "POST" },
  );
}

export async function listIntegrations() {
  return apiFetch<{ items: IntegrationEndpoint[] }>("/api/v1/business/integrations", {
    method: "GET",
  });
}

export async function createIntegration(payload: {
  name: string;
  endpointUrl: string;
  authType?: "none" | "bearer";
  authToken?: string | null;
  isEnabled?: boolean;
  subscribedEvents?: string[];
}) {
  return apiFetch<IntegrationEndpoint>("/api/v1/business/integrations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateIntegration(
  id: string,
  payload: Partial<{
    name: string;
    endpointUrl: string;
    authType: "none" | "bearer";
    authToken: string | null;
    isEnabled: boolean;
    subscribedEvents: string[];
  }>,
) {
  return apiFetch<IntegrationEndpoint>(`/api/v1/business/integrations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteIntegration(id: string) {
  return apiFetch<{ deleted: true }>(`/api/v1/business/integrations/${id}`, {
    method: "DELETE",
  });
}

export async function exportTendersJson(params?: {
  lifecycle?: "all" | "open" | "awarded" | "closed" | "cancelled";
  take?: number;
}) {
  const lifecycle = params?.lifecycle ?? "all";
  const take = params?.take ?? 200;
  return apiFetch<{ items: unknown[]; count: number }>(
    `/api/v1/business/integrations/exports/tenders?lifecycle=${lifecycle}&take=${take}`,
    { method: "GET" },
  );
}

export async function getOnboardingAssistance() {
  return apiFetch<{ status: string; requestedAt: string | null; notes: string | null }>(
    "/api/v1/business/onboarding-assistance",
    { method: "GET" },
  );
}

export async function requestOnboardingAssistance(notes?: string) {
  return apiFetch<{ status: string; requestedAt: string | null; notes: string | null }>(
    "/api/v1/business/onboarding-assistance/request",
    { method: "POST",
      body: JSON.stringify({ notes }),
    },
  );
}

export async function listSupportTickets() {
  return apiFetch<{ items: SupportTicket[] }>("/api/v1/business/support/tickets", {
    method: "GET",
  });
}

export async function createSupportTicket(payload: {
  subject: string;
  description: string;
  priority?: "low" | "normal" | "high" | "urgent";
}) {
  return apiFetch<SupportTicket>("/api/v1/business/support/tickets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSupportTicket(
  id: string,
  payload: Partial<{
    status: "open" | "in_progress" | "resolved" | "closed";
    resolutionNotes: string | null;
  }>,
) {
  return apiFetch<SupportTicket>(`/api/v1/business/support/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getAccountManager() {
  return apiFetch<{
    name: string | null;
    email: string | null;
    notes: string | null;
    supportSlaHours: number;
  }>("/api/v1/business/account-manager", {
    method: "GET",
  });
}
