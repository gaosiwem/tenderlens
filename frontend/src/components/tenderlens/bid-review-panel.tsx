"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FileSearch,
  ListChecks,
} from "lucide-react";
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
import type { BidAttachment } from "@/lib/workspace.types";
import type {
  BidReview,
  BidReviewEvidence,
  BidReviewFinding,
  BidReviewFindingCategory,
  BidReviewFindingSeverity,
} from "@/lib/bid-review.types";

const categoryLabels: Record<BidReviewFindingCategory, string> = {
  UNANSWERED_REQUIREMENT: "Unanswered requirements",
  WEAK_RESPONSE: "Weak responses",
  MISSING_EVIDENCE: "Missing evidence",
  POOR_STRUCTURE: "Structure issues",
  COMPLIANCE_GAP: "Compliance gaps",
  UNCLEAR_PRICING: "Pricing clarity",
  EVALUATOR_RED_FLAG: "Evaluator red flags",
};

const categoryOrder: BidReviewFindingCategory[] = [
  "UNANSWERED_REQUIREMENT",
  "WEAK_RESPONSE",
  "MISSING_EVIDENCE",
  "POOR_STRUCTURE",
  "COMPLIANCE_GAP",
  "UNCLEAR_PRICING",
  "EVALUATOR_RED_FLAG",
];

const severityRank: Record<BidReviewFindingSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function readinessLabel(score: number | null) {
  if (score === null) return "Review pending";
  if (score >= 80) return "Strong proposal";
  if (score >= 60) return "Needs improvement";
  return "High submission risk";
}

function severityClass(severity: BidReviewFindingSeverity) {
  if (severity === "CRITICAL") return "border-red-300 bg-red-50 text-red-700";
  if (severity === "HIGH") return "border-amber-300 bg-amber-50 text-amber-700";
  if (severity === "MEDIUM") {
    return "border-yellow-300 bg-yellow-50 text-yellow-700";
  }
  return "border-border bg-background text-muted-foreground";
}

function highestSeverity(findings: BidReviewFinding[]) {
  return findings.reduce<BidReviewFindingSeverity | null>((current, finding) => {
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

function isProposalLike(file: BidAttachment) {
  const name = file.filename.toLowerCase();
  return (
    /proposal|bid|response|submission|technical|pricing|boq|quotation/.test(
      name,
    ) || !/brief|tender|specification|terms|rfp|rfq|advert/.test(name)
  );
}

export function getDefaultProposalFileIds(files: BidAttachment[]) {
  const proposalFiles = files.filter(isProposalLike);
  return (proposalFiles.length ? proposalFiles : files).map((file) => file.id);
}

export function TLBidReviewScoreCard(props: {
  review: BidReview | null;
  loading?: boolean;
  disabled?: boolean;
  onRun: () => void;
  onRerun: () => void;
}) {
  const score = props.review?.score ?? null;
  const isProcessing =
    props.review?.status === "PENDING" || props.review?.status === "PROCESSING";
  const isFailed = props.review?.status === "FAILED";

  return (
    <Card className="tl-surface">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileCheck2 className="size-5 text-primary" />
              <h2 className="font-display text-lg font-extrabold">
                AI Bid Reviewer
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Checks unanswered requirements, weak responses, evidence gaps,
              structure, compliance, pricing, and evaluator red flags.
            </p>
          </div>
          {props.review ? (
            <TLButton
              variant="secondary"
              onClick={props.onRerun}
              loading={props.loading}
              disabled={props.disabled}
            >
              Rerun review
            </TLButton>
          ) : (
            <TLButton
              onClick={props.onRun}
              loading={props.loading}
              disabled={props.disabled}
            >
              Run bid review
            </TLButton>
          )}
        </div>

        {props.review ? (
          <div className="grid gap-3 md:grid-cols-[180px_1fr]">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs font-semibold text-muted-foreground">
                Readiness Score
              </div>
              <div className="mt-2 font-display text-4xl font-black">
                {score === null ? "--" : `${score}%`}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {readinessLabel(score)}
              </div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap gap-2">
                <TLCodeBadge value={props.review.status} />
                {isProcessing ? <TLCodeBadge value="RUNNING" /> : null}
                {isFailed ? <TLCodeBadge value="FAILED" /> : null}
              </div>
              <p className="mt-3 text-sm leading-6">
                {props.review.summary ??
                  (isProcessing
                    ? "Reviewing proposal..."
                    : "No review summary available yet.")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Completed: {formatDate(props.review.completedAt)}
              </p>
            </div>
          </div>
        ) : (
          <TLInlineAlert
            variant="neutral"
            title="No bid review has been run for this tender yet"
            description="Select proposal files and run a review before submission."
          />
        )}
      </CardContent>
    </Card>
  );
}

function SummaryList(props: {
  title: string;
  items: string[];
  empty: string;
  tone?: "good" | "warn" | "bad";
}) {
  const Icon =
    props.tone === "good"
      ? CheckCircle2
      : props.tone === "bad"
        ? AlertTriangle
        : ListChecks;

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="text-sm font-bold">{props.title}</h3>
      </div>
      {props.items.length ? (
        <ul className="mt-3 space-y-2">
          {props.items.map((item) => (
            <li key={item} className="text-sm leading-6 text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{props.empty}</p>
      )}
    </section>
  );
}

export function TLBidReviewSummary(props: { review: BidReview }) {
  return (
    <Card className="tl-surface">
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center gap-2">
          <ListChecks className="size-5 text-primary" />
          <h2 className="font-display text-base font-extrabold">
            Evaluator readiness
          </h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <SummaryList
            title="Strengths"
            tone="good"
            items={props.review.strengths}
            empty="No strengths were highlighted yet."
          />
          <SummaryList
            title="Needs improvement"
            tone="warn"
            items={props.review.weaknesses}
            empty="No major improvement areas detected."
          />
          <SummaryList
            title="Evaluator red flags"
            tone="bad"
            items={props.review.redFlags}
            empty="No major evaluator red flags detected."
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function TLProposalFileSelector(props: {
  files: BidAttachment[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  tenderId: string;
}) {
  if (!props.files.length) {
    return (
      <TLInlineAlert
        variant="warning"
        title="Upload a proposal document before running a bid review"
      >
        <a className="font-semibold underline" href={`/tenders/${props.tenderId}/workspace`}>
          Go to workspace
        </a>
      </TLInlineAlert>
    );
  }

  function toggle(fileId: string) {
    props.onChange(
      props.selectedIds.includes(fileId)
        ? props.selectedIds.filter((id) => id !== fileId)
        : [...props.selectedIds, fileId],
    );
  }

  return (
    <Card className="tl-surface">
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center gap-2">
          <FileSearch className="size-5 text-primary" />
          <h2 className="font-display text-base font-extrabold">
            Proposal files
          </h2>
        </div>
        <div className="space-y-2">
          {props.files.map((file) => (
            <label
              key={file.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition hover:bg-muted/60"
            >
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={props.selectedIds.includes(file.id)}
                onChange={() => toggle(file.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {file.filename}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {file.mimeType} | {formatDate(file.createdAt)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TLBidReviewFindingGroup(props: {
  category: BidReviewFindingCategory;
  findings: BidReviewFinding[];
  onEvidence: (finding: BidReviewFinding) => void;
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
            {props.findings.length} finding
            {props.findings.length === 1 ? "" : "s"}
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
          <TLBidReviewFindingRow
            key={finding.id}
            finding={finding}
            onEvidence={() => props.onEvidence(finding)}
          />
        ))}
      </div>
    </section>
  );
}

export function TLBidReviewFindingRow(props: {
  finding: BidReviewFinding;
  onEvidence: () => void;
}) {
  const hasEvidence = props.finding.evidence.length > 0;

  return (
    <article className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                severityClass(props.finding.severity),
              )}
            >
              {props.finding.severity}
            </span>
            <TLCodeBadge value={categoryLabels[props.finding.category]} />
          </div>
          {props.finding.affectedSection ? (
            <div className="text-xs font-semibold text-muted-foreground">
              {props.finding.affectedSection}
            </div>
          ) : null}
          <h3 className="font-semibold leading-6">{props.finding.title}</h3>
          {props.finding.requirement ? (
            <p className="text-sm text-muted-foreground">
              {props.finding.requirement}
            </p>
          ) : null}
          {props.finding.proposalExcerpt ? (
            <p className="rounded-lg bg-muted/60 p-3 text-sm leading-6">
              {props.finding.proposalExcerpt}
            </p>
          ) : null}
          {props.finding.recommendation ? (
            <p className="text-sm leading-6">{props.finding.recommendation}</p>
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

export function TLBidReviewEvidenceDrawer(props: {
  finding: BidReviewFinding | null;
  onClose: () => void;
}) {
  const evidence: BidReviewEvidence[] = props.finding?.evidence ?? [];

  return (
    <Dialog open={Boolean(props.finding)} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{props.finding?.title ?? "Evidence"}</DialogTitle>
          <DialogDescription>
            Tender, proposal, and compliance snippets used by the bid reviewer.
          </DialogDescription>
        </DialogHeader>
        {evidence.length ? (
          <div className="space-y-3">
            {evidence.map((item, index) => (
              <div
                key={`${item.source}:${item.chunkId ?? item.filename ?? index}`}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <TLCodeBadge value={item.source.replace("_", " ")} />
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

export function TLBidReviewHistory(props: {
  reviews: BidReview[];
  selectedId: string | null;
  onSelect: (review: BidReview) => void;
}) {
  return (
    <Card className="tl-surface">
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center gap-2">
          <FileSearch className="size-5 text-primary" />
          <h2 className="font-display text-base font-extrabold">
            Review history
          </h2>
        </div>
        {props.reviews.length ? (
          <div className="space-y-2">
            {props.reviews.map((review) => (
              <button
                key={review.id}
                type="button"
                onClick={() => props.onSelect(review)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition hover:bg-muted/60",
                  review.id === props.selectedId
                    ? "border-primary bg-primary/5"
                    : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {review.score === null ? "--" : `${review.score}%`}
                  </span>
                  <TLCodeBadge value={review.status} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatDate(review.createdAt)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Red flags: {review.redFlags.length} | Files:{" "}
                  {review.proposalFileIds.length}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Previous bid reviews will appear here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function groupBidReviewFindings(findings: BidReviewFinding[]) {
  return categoryOrder
    .map((category) => ({
      category,
      findings: findings.filter((finding) => finding.category === category),
    }))
    .filter((group) => group.findings.length > 0);
}
