-- BUSINESS plan capabilities (excluding bulk tender imports)

-- OrgBillingPolicy custom limit overrides
ALTER TABLE "OrgBillingPolicy"
  ADD COLUMN IF NOT EXISTS "customMaxAiQueries" INTEGER,
  ADD COLUMN IF NOT EXISTS "customMaxWatchlist" INTEGER,
  ADD COLUMN IF NOT EXISTS "customMaxMembers" INTEGER,
  ADD COLUMN IF NOT EXISTS "customExportsEnabled" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "customWorkspaceEnabled" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "customCompareEnabled" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "customWhatsappEnabled" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "customRiskEnabled" BOOLEAN;

-- BUSINESS profile (alerts automation, governance, onboarding, support SLA, account manager)
CREATE TABLE IF NOT EXISTS "OrgBusinessProfile" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "alertAutomationEnabled" BOOLEAN NOT NULL DEFAULT true,
  "alertDefaultChannels" TEXT[] NOT NULL DEFAULT ARRAY['email']::TEXT[],
  "alertEscalationEnabled" BOOLEAN NOT NULL DEFAULT false,
  "alertEscalationMinutes" INTEGER NOT NULL DEFAULT 120,
  "alertEscalationChannels" TEXT[] NOT NULL DEFAULT ARRAY['whatsapp']::TEXT[],
  "taskGovernanceEnabled" BOOLEAN NOT NULL DEFAULT true,
  "requireTaskOwner" BOOLEAN NOT NULL DEFAULT true,
  "requireTaskDueDate" BOOLEAN NOT NULL DEFAULT true,
  "blockTaskCloseWithoutAssignee" BOOLEAN NOT NULL DEFAULT false,
  "blockTaskCloseWithoutDueDate" BOOLEAN NOT NULL DEFAULT false,
  "supportSlaHours" INTEGER NOT NULL DEFAULT 4,
  "onboardingAssistanceStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  "onboardingAssistanceRequestedAt" TIMESTAMP(3),
  "onboardingAssistanceNotes" TEXT,
  "accountManagerName" TEXT,
  "accountManagerEmail" TEXT,
  "accountManagerNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrgBusinessProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgBusinessProfile_orgId_key"
  ON "OrgBusinessProfile"("orgId");

ALTER TABLE "OrgBusinessProfile"
  DROP CONSTRAINT IF EXISTS "OrgBusinessProfile_orgId_fkey";
ALTER TABLE "OrgBusinessProfile"
  ADD CONSTRAINT "OrgBusinessProfile_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Workspace templates and templated tasks
CREATE TABLE IF NOT EXISTS "WorkspaceTemplate" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkspaceTemplate_orgId_idx"
  ON "WorkspaceTemplate"("orgId");
CREATE INDEX IF NOT EXISTS "WorkspaceTemplate_isArchived_idx"
  ON "WorkspaceTemplate"("isArchived");
CREATE INDEX IF NOT EXISTS "WorkspaceTemplate_updatedAt_idx"
  ON "WorkspaceTemplate"("updatedAt");

ALTER TABLE "WorkspaceTemplate"
  DROP CONSTRAINT IF EXISTS "WorkspaceTemplate_orgId_fkey";
ALTER TABLE "WorkspaceTemplate"
  ADD CONSTRAINT "WorkspaceTemplate_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "WorkspaceTemplateTask" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "dueInDays" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceTemplateTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkspaceTemplateTask_templateId_idx"
  ON "WorkspaceTemplateTask"("templateId");
CREATE INDEX IF NOT EXISTS "WorkspaceTemplateTask_sortOrder_idx"
  ON "WorkspaceTemplateTask"("sortOrder");

ALTER TABLE "WorkspaceTemplateTask"
  DROP CONSTRAINT IF EXISTS "WorkspaceTemplateTask_templateId_fkey";
ALTER TABLE "WorkspaceTemplateTask"
  ADD CONSTRAINT "WorkspaceTemplateTask_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "WorkspaceTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- API-style integrations/webhooks
CREATE TABLE IF NOT EXISTS "OrgIntegrationEndpoint" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'webhook',
  "endpointUrl" TEXT NOT NULL,
  "authType" TEXT NOT NULL DEFAULT 'none',
  "authToken" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "subscribedEvents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "lastDeliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrgIntegrationEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrgIntegrationEndpoint_orgId_idx"
  ON "OrgIntegrationEndpoint"("orgId");
CREATE INDEX IF NOT EXISTS "OrgIntegrationEndpoint_isEnabled_idx"
  ON "OrgIntegrationEndpoint"("isEnabled");

ALTER TABLE "OrgIntegrationEndpoint"
  DROP CONSTRAINT IF EXISTS "OrgIntegrationEndpoint_orgId_fkey";
ALTER TABLE "OrgIntegrationEndpoint"
  ADD CONSTRAINT "OrgIntegrationEndpoint_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Priority support requests
CREATE TABLE IF NOT EXISTS "OrgSupportTicket" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolutionNotes" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrgSupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrgSupportTicket_orgId_idx"
  ON "OrgSupportTicket"("orgId");
CREATE INDEX IF NOT EXISTS "OrgSupportTicket_status_idx"
  ON "OrgSupportTicket"("status");
CREATE INDEX IF NOT EXISTS "OrgSupportTicket_createdAt_idx"
  ON "OrgSupportTicket"("createdAt");

ALTER TABLE "OrgSupportTicket"
  DROP CONSTRAINT IF EXISTS "OrgSupportTicket_orgId_fkey";
ALTER TABLE "OrgSupportTicket"
  ADD CONSTRAINT "OrgSupportTicket_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
