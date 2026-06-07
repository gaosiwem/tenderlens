import { apiFetch } from "@/lib/api";
import type { ComplianceAudit } from "@/lib/compliance.types";

export async function startComplianceAudit(tenderId: string) {
  return apiFetch<{ audit: ComplianceAudit }>(
    `/api/v1/tenders/${tenderId}/compliance-audits`,
    { method: "POST" },
  );
}

export async function listComplianceAudits(tenderId: string) {
  return apiFetch<{ items: ComplianceAudit[] }>(
    `/api/v1/tenders/${tenderId}/compliance-audits`,
    { method: "GET" },
  );
}

export async function getComplianceAudit(auditId: string) {
  return apiFetch<{ audit: ComplianceAudit }>(
    `/api/v1/compliance-audits/${auditId}`,
    { method: "GET" },
  );
}

export async function rerunComplianceAudit(auditId: string) {
  return apiFetch<{ audit: ComplianceAudit }>(
    `/api/v1/compliance-audits/${auditId}/rerun`,
    { method: "POST" },
  );
}
