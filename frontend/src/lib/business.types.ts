export type BusinessProfile = {
  id: string;
  orgId: string;
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
  onboardingAssistanceStatus: string;
  onboardingAssistanceRequestedAt: string | null;
  onboardingAssistanceNotes: string | null;
  accountManagerName: string | null;
  accountManagerEmail: string | null;
  accountManagerNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessCustomLimits = {
  maxAiQueries: number | null;
  maxWatchlist: number | null;
  maxMembers: number | null;
  exportsEnabled: boolean | null;
  workspaceEnabled: boolean | null;
  compareEnabled: boolean | null;
  whatsappEnabled: boolean | null;
  riskEnabled: boolean | null;
};

export type BusinessAnalytics = {
  workspaces: number;
  tasks: {
    total: number;
    completed: number;
    completionRate: number;
  };
  watchlistCount: number;
  alertsFired30d: number;
  comparisons30d: number;
  openSupportTickets: number;
  templatesCount: number;
  integrationsCount: number;
  avgRiskScore: number;
  tendersByLifecycle: {
    open: number;
    awarded: number;
    closed: number;
    cancelled: number;
    other: number;
  };
};

export type WorkspaceTemplateTask = {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  tags: string[];
  dueInDays: number | null;
  sortOrder: number;
  createdAt: string;
};

export type WorkspaceTemplate = {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isArchived: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  tasks: WorkspaceTemplateTask[];
};

export type IntegrationEndpoint = {
  id: string;
  orgId: string;
  name: string;
  type: string;
  endpointUrl: string;
  authType: "none" | "bearer";
  authToken?: string | null;
  hasAuthToken?: boolean;
  isEnabled: boolean;
  subscribedEvents: string[];
  lastDeliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupportTicket = {
  id: string;
  orgId: string;
  createdBy: string;
  subject: string;
  description: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  resolutionNotes: string | null;
  resolvedAt: string | null;
  slaDueAt: string;
  slaRemainingMinutes: number;
  slaBreached: boolean;
  escalated: boolean;
  createdAt: string;
  updatedAt: string;
};
