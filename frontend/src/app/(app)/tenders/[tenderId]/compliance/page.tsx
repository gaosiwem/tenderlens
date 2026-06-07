"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import {
  TLComplianceAuditHistory,
  TLComplianceEvidenceDrawer,
  TLComplianceFindingGroup,
  TLComplianceScoreCard,
  TLMissingReturnables,
  groupComplianceFindings,
} from "@/components/tenderlens/compliance-audit-panel";
import {
  getComplianceAudit,
  listComplianceAudits,
  rerunComplianceAudit,
  startComplianceAudit,
} from "@/lib/compliance.api";
import type {
  ComplianceAudit,
  ComplianceFinding,
} from "@/lib/compliance.types";

function isRunning(audit: ComplianceAudit | null) {
  return audit?.status === "PENDING" || audit?.status === "PROCESSING";
}

export default function TenderCompliancePage() {
  const params = useParams();
  const tenderId = params.tenderId as string;

  const [audits, setAudits] = React.useState<ComplianceAudit[]>([]);
  const [selected, setSelected] = React.useState<ComplianceAudit | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [evidenceFinding, setEvidenceFinding] =
    React.useState<ComplianceFinding | null>(null);

  const loadAudits = React.useCallback(async () => {
    setError(null);
    const res = await listComplianceAudits(tenderId);
    if (!res.ok) {
      setError(res.error.message);
      setAudits([]);
      setSelected(null);
      return;
    }

    setAudits(res.data.items);
    setSelected((current) => {
      if (current) {
        return res.data.items.find((audit) => audit.id === current.id) ?? res.data.items[0] ?? null;
      }
      return res.data.items[0] ?? null;
    });
  }, [tenderId]);

  React.useEffect(() => {
    void loadAudits().finally(() => setLoading(false));
  }, [loadAudits]);

  React.useEffect(() => {
    if (!selected || !isRunning(selected)) return;

    const timer = setInterval(async () => {
      const res = await getComplianceAudit(selected.id);
      if (!res.ok) return;
      setSelected(res.data.audit);
      setAudits((items) =>
        items.map((audit) =>
          audit.id === res.data.audit.id ? res.data.audit : audit,
        ),
      );
      if (!isRunning(res.data.audit)) {
        void loadAudits();
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [loadAudits, selected]);

  async function runAudit() {
    setRunning(true);
    const res = await startComplianceAudit(tenderId);
    setRunning(false);
    if (!res.ok) {
      toast.error("Compliance audit failed", { description: res.error.message });
      return;
    }
    setSelected(res.data.audit);
    setAudits((items) => [res.data.audit, ...items]);
    toast.success("Compliance audit started");
  }

  async function rerunAudit() {
    if (!selected) return;
    setRunning(true);
    const res = await rerunComplianceAudit(selected.id);
    setRunning(false);
    if (!res.ok) {
      toast.error("Compliance audit failed", { description: res.error.message });
      return;
    }
    setSelected(res.data.audit);
    setAudits((items) => [res.data.audit, ...items]);
    toast.success("Compliance audit restarted");
  }

  const groups = groupComplianceFindings(selected?.findings ?? []);

  return (
    <TenderLensAppShell
      title="Compliance"
      description="AI-assisted review of tender returnables, eligibility, and submission risks."
      showSearch={false}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={`/tenders/${tenderId}`}>
            <TLButton variant="outline">
              <ArrowLeft className="mr-2 size-4" />
              Tender
            </TLButton>
          </Link>
          <TLButton variant="secondary" onClick={() => void loadAudits()}>
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </TLButton>
        </div>
      }
    >
      <TLSection>
        {error ? (
          <TLInlineAlert variant="error" title="Unable to load audits">
            {error}
          </TLInlineAlert>
        ) : null}

        {loading ? (
          <TLInlineAlert
            variant="neutral"
            title="Loading compliance audits"
            description="Checking existing compliance history for this tender."
          />
        ) : null}

        {selected?.status === "FAILED" ? (
          <TLInlineAlert
            variant="error"
            title="Compliance audit could not be completed"
            description={
              selected.error ??
              "Try again after confirming the tender documents have been processed."
            }
          />
        ) : null}

        {isRunning(selected) ? (
          <TLInlineAlert
            variant="info"
            title="Auditing tender compliance"
            description="Checking mandatory documents, CIDB, B-BBEE, briefing, tax/CSD, returnables, and submission risks."
          />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <TLComplianceScoreCard
              audit={selected}
              loading={running}
              onRun={() => void runAudit()}
              onRerun={() => void rerunAudit()}
            />

            {selected ? (
              <>
                <TLMissingReturnables missing={selected.missing} />
                {groups.length ? (
                  <div className="space-y-4">
                    {groups.map((group) => (
                      <TLComplianceFindingGroup
                        key={group.category}
                        category={group.category}
                        findings={group.findings}
                        onEvidence={setEvidenceFinding}
                      />
                    ))}
                  </div>
                ) : selected.status === "COMPLETED" ? (
                  <TLInlineAlert
                    variant="success"
                    title="No major compliance findings"
                    description="The auditor did not detect major missing returnables or submission risks."
                  />
                ) : null}
              </>
            ) : (
              <TLInlineAlert
                variant="neutral"
                title="No compliance audit has been run for this tender yet"
                description="Run an audit to produce a compliance score and missing returnables list."
              />
            )}
          </div>

          <TLComplianceAuditHistory
            audits={audits}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        </div>
      </TLSection>

      <TLComplianceEvidenceDrawer
        finding={evidenceFinding}
        onClose={() => setEvidenceFinding(null)}
      />
    </TenderLensAppShell>
  );
}
