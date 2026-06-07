"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, FileSearch, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TLButton } from "@/components/tenderlens/button";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { cn } from "@/lib/utils";
import type {
  ComplianceAudit,
  ComplianceEvidence,
  ComplianceFinding,
  ComplianceFindingCategory,
  ComplianceFindingSeverity,
} from "@/lib/compliance.types";

const categoryLabels: Record<ComplianceFindingCategory, string> = {
  mandatory_documents: "Mandatory documents",
  cidb: "CIDB",
  bbbee: "B-BBEE",
  briefing_session: "Briefing session",
  tax_csd: "Tax/CSD",
  returnables: "Returnables",
  submission_risk: "Submission risks",
};

const categoryOrder: ComplianceFindingCategory[] = [
  "mandatory_documents",
  "cidb",
  "bbbee",
  "briefing_session",
  "tax_csd",
  "returnables",
  "submission_risk",
];

const severityRank: Record<ComplianceFindingSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function scoreLabel(score: number | null) {
  if (score === null) return "Audit pending";
  if (score >= 80) return "Ready with minor checks";
  if (score >= 60) return "Needs attention";
  return "High risk";
}

function severityClass(severity: ComplianceFindingSeverity) {
  if (severity === "CRITICAL") return "border-red-300 text-red-700 bg-red-50";
  if (severity === "HIGH") return "border-amber-300 text-amber-700 bg-amber-50";
  if (severity === "MEDIUM") return "border-yellow-300 text-yellow-700 bg-yellow-50";
  return "border-border text-muted-foreground bg-background";
}

function highestSeverity(findings: ComplianceFinding[]) {
  return findings.reduce<ComplianceFindingSeverity | null>((current, finding) => {
    if (!current) return finding.severity;
    return severityRank[finding.severity] > severityRank[current]
      ? finding.severity
      : current;
  }, null);
}

function formatDate(value: string | null) {
  if (!value) return "Not completed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString();
}

export function TLComplianceScoreCard(props: {
  audit: ComplianceAudit | null;
  loading?: boolean;
  onRun: () => void;
  onRerun: () => void;
}) {
  const score = props.audit?.score ?? null;
  const isProcessing =
    props.audit?.status === "PENDING" || props.audit?.status === "PROCESSING";
  const isFailed = props.audit?.status === "FAILED";
  const auditMessage =
    (isFailed ? props.audit?.error : null) ??
    props.audit?.summary ??
    (isProcessing
      ? "Auditing tender compliance..."
      : "No audit summary available yet.");

  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <h2 className="font-display text-lg font-extrabold">
                AI Compliance Auditor
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Checks required documents, CIDB, B-BBEE, briefing, tax/CSD,
              returnables, and submission risks.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {props.audit ? (
              <TLButton
                variant="secondary"
                onClick={props.onRerun}
                loading={props.loading}
              >
                Rerun audit
              </TLButton>
            ) : (
              <TLButton onClick={props.onRun} loading={props.loading}>
                Run audit
              </TLButton>
            )}
          </div>
        </div>

        {props.audit ? (
          <div className="grid gap-3 md:grid-cols-[180px_1fr]">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs font-semibold text-muted-foreground">
                Compliance Score
              </div>
              <div className="mt-2 font-display text-4xl font-black">
                {score === null ? "--" : `${score}%`}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {scoreLabel(score)}
              </div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap gap-2">
                <TLCodeBadge value={props.audit.status} />
                {isProcessing ? <TLCodeBadge value="RUNNING" /> : null}
                {isFailed ? <TLCodeBadge value="FAILED" /> : null}
              </div>
              <p className="mt-3 text-sm leading-6">
                {auditMessage}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Completed: {formatDate(props.audit.completedAt)}
              </p>
            </div>
          </div>
        ) : (
          <TLInlineAlert
            variant="neutral"
            title="No compliance audit yet"
            description="Run an audit to check mandatory documents, returnables, and submission risks."
          />
        )}
      </CardContent>
    </Card>
  );
}

export function TLMissingReturnables(props: { missing: string[] }) {
  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          {props.missing.length ? (
            <AlertTriangle className="size-5 text-amber-600" />
          ) : (
            <CheckCircle2 className="size-5 text-emerald-600" />
          )}
          <h2 className="font-display text-base font-extrabold">
            Missing returnables
          </h2>
        </div>
        {props.missing.length ? (
          <div className="flex flex-wrap gap-2">
            {props.missing.map((item) => (
              <TLCodeBadge key={item} value={item} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No missing mandatory returnables detected.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function TLComplianceFindingGroup(props: {
  category: ComplianceFindingCategory;
  findings: ComplianceFinding[];
  onEvidence: (finding: ComplianceFinding) => void;
}) {
  const topSeverity = highestSeverity(props.findings);

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-extrabold">
            {categoryLabels[props.category]}
          </h2>
          <p className="text-xs text-muted-foreground">
            {props.findings.length} finding{props.findings.length === 1 ? "" : "s"}
          </p>
        </div>
        {topSeverity ? (
          <span
            className={cn(
              "inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold",
              severityClass(topSeverity),
            )}
          >
            {topSeverity}
          </span>
        ) : null}
      </div>
      <div className="divide-y divide-border">
        {props.findings.map((finding) => (
          <TLComplianceFindingRow
            key={finding.id}
            finding={finding}
            onEvidence={() => props.onEvidence(finding)}
          />
        ))}
      </div>
    </section>
  );
}

export function TLComplianceFindingRow(props: {
  finding: ComplianceFinding;
  onEvidence: () => void;
}) {
  const hasEvidence = props.finding.evidence.length > 0;

  return (
    <article className="p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                severityClass(props.finding.severity),
              )}
            >
              {props.finding.severity}
            </span>
            <TLCodeBadge value={props.finding.status} />
          </div>
          <h3 className="font-semibold leading-6">{props.finding.title}</h3>
          {props.finding.requirement ? (
            <p className="text-sm text-muted-foreground">
              {props.finding.requirement}
            </p>
          ) : null}
          {props.finding.suggestion ? (
            <p className="text-sm leading-6">{props.finding.suggestion}</p>
          ) : null}
        </div>
        <TLButton
          type="button"
          variant="outline"
          size="sm"
          onClick={props.onEvidence}
          disabled={!hasEvidence}
        >
          Evidence
        </TLButton>
      </div>
    </article>
  );
}

export function TLComplianceEvidenceDrawer(props: {
  finding: ComplianceFinding | null;
  onClose: () => void;
}) {
  const evidence: ComplianceEvidence[] = props.finding?.evidence ?? [];

  return (
    <Dialog open={Boolean(props.finding)} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{props.finding?.title ?? "Evidence"}</DialogTitle>
          <DialogDescription>
            Source snippets used by the compliance auditor.
          </DialogDescription>
        </DialogHeader>
        {evidence.length ? (
          <div className="space-y-3">
            {evidence.map((item, index) => (
              <div key={`${item.chunkId ?? item.filename ?? index}`} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{item.filename ?? "Unknown source"}</span>
                  {item.page ? <span>Page {item.page}</span> : null}
                  {item.chunkId ? <span>Chunk {item.chunkId}</span> : null}
                </div>
                <p className="mt-2 text-sm leading-6">
                  {item.quote ?? "No quote captured."}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No supporting evidence was found for this item.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TLComplianceAuditHistory(props: {
  audits: ComplianceAudit[];
  selectedId: string | null;
  onSelect: (audit: ComplianceAudit) => void;
}) {
  return (
    <Card className="tl-surface">
      <CardContent className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <FileSearch className="size-5 text-primary" />
          <h2 className="font-display text-base font-extrabold">
            Audit history
          </h2>
        </div>
        {props.audits.length ? (
          <div className="space-y-2">
            {props.audits.map((audit) => (
              <button
                key={audit.id}
                type="button"
                onClick={() => props.onSelect(audit)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition hover:bg-muted/60",
                  audit.id === props.selectedId
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {audit.score === null ? "--" : `${audit.score}%`}
                  </span>
                  <TLCodeBadge value={audit.status} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDate(audit.createdAt)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Missing items: {audit.missing.length}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Previous audits will appear here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function groupComplianceFindings(findings: ComplianceFinding[]) {
  return categoryOrder
    .map((category) => ({
      category,
      findings: findings.filter((finding) => finding.category === category),
    }))
    .filter((group) => group.findings.length > 0);
}
