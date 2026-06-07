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
  getDefaultProposalFileIds,
  groupBidReviewFindings,
  TLBidReviewEvidenceDrawer,
  TLBidReviewFindingGroup,
  TLBidReviewHistory,
  TLBidReviewScoreCard,
  TLBidReviewSummary,
  TLProposalFileSelector,
} from "@/components/tenderlens/bid-review-panel";
import {
  getBidReview,
  listBidReviews,
  rerunBidReview,
  startBidReview,
} from "@/lib/bid-review.api";
import type { BidReview, BidReviewFinding } from "@/lib/bid-review.types";
import { getWorkspaceByTender } from "@/lib/workspace.api";
import type { BidAttachment } from "@/lib/workspace.types";

function isRunning(review: BidReview | null) {
  return review?.status === "PENDING" || review?.status === "PROCESSING";
}

export default function TenderBidReviewPage() {
  const params = useParams();
  const tenderId = params.tenderId as string;

  const [reviews, setReviews] = React.useState<BidReview[]>([]);
  const [selected, setSelected] = React.useState<BidReview | null>(null);
  const [attachments, setAttachments] = React.useState<BidAttachment[]>([]);
  const [selectedFileIds, setSelectedFileIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [evidenceFinding, setEvidenceFinding] =
    React.useState<BidReviewFinding | null>(null);

  const loadReviews = React.useCallback(async () => {
    setError(null);
    const res = await listBidReviews(tenderId);
    if (!res.ok) {
      setError(res.error.message);
      setReviews([]);
      setSelected(null);
      return;
    }

    setReviews(res.data.items);
    setSelected((current) => {
      if (current) {
        return (
          res.data.items.find((review) => review.id === current.id) ??
          res.data.items[0] ??
          null
        );
      }
      return res.data.items[0] ?? null;
    });
  }, [tenderId]);

  const loadWorkspace = React.useCallback(async () => {
    const res = await getWorkspaceByTender(tenderId);
    if (!res.ok) {
      setAttachments([]);
      setSelectedFileIds([]);
      return;
    }
    const files = res.data.attachments ?? [];
    setAttachments(files);
    setSelectedFileIds((current) =>
      current.length ? current : getDefaultProposalFileIds(files),
    );
  }, [tenderId]);

  React.useEffect(() => {
    void Promise.all([loadReviews(), loadWorkspace()]).finally(() =>
      setLoading(false),
    );
  }, [loadReviews, loadWorkspace]);

  React.useEffect(() => {
    if (!selected || !isRunning(selected)) return;

    const timer = setInterval(async () => {
      const res = await getBidReview(selected.id);
      if (!res.ok) return;
      setSelected(res.data.review);
      setReviews((items) =>
        items.map((review) =>
          review.id === res.data.review.id ? res.data.review : review,
        ),
      );
      if (!isRunning(res.data.review)) {
        void loadReviews();
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [loadReviews, selected]);

  async function runReview() {
    if (!selectedFileIds.length) {
      toast.error("Select at least one proposal file");
      return;
    }

    setRunning(true);
    const res = await startBidReview(tenderId, selectedFileIds);
    setRunning(false);
    if (!res.ok) {
      toast.error("Bid review failed", { description: res.error.message });
      return;
    }
    setSelected(res.data.review);
    setReviews((items) => [res.data.review, ...items]);
    toast.success("Bid review started");
  }

  async function rerunReview() {
    if (!selected) return;
    setRunning(true);
    const res = await rerunBidReview(selected.id);
    setRunning(false);
    if (!res.ok) {
      toast.error("Bid review failed", { description: res.error.message });
      return;
    }
    setSelected(res.data.review);
    setReviews((items) => [res.data.review, ...items]);
    toast.success("Bid review restarted");
  }

  const groups = groupBidReviewFindings(selected?.findings ?? []);
  const hasProposalFiles = attachments.length > 0;

  return (
    <TenderLensAppShell
      title="Bid Review"
      description="Pre-submission evaluator-readiness review for proposal quality, evidence, pricing, and red flags."
      showSearch={false}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href={`/tenders/${tenderId}`}>
            <TLButton variant="outline">
              <ArrowLeft className="mr-2 size-4" />
              Tender
            </TLButton>
          </Link>
          <TLButton
            variant="secondary"
            onClick={() => void Promise.all([loadReviews(), loadWorkspace()])}
          >
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </TLButton>
        </div>
      }
    >
      <TLSection>
        {error ? (
          <TLInlineAlert variant="error" title="Unable to load bid reviews">
            {error}
          </TLInlineAlert>
        ) : null}

        {loading ? (
          <TLInlineAlert
            variant="neutral"
            title="Loading bid review workspace"
            description="Checking proposal files and review history."
          />
        ) : null}

        {selected?.status === "FAILED" ? (
          <TLInlineAlert
            variant="error"
            title="Bid review could not be completed"
            description="Try again after confirming proposal files are readable."
          />
        ) : null}

        {isRunning(selected) ? (
          <TLInlineAlert
            variant="info"
            title="Reviewing proposal..."
            description="Checking unanswered requirements, weak responses, missing evidence, structure, compliance gaps, pricing, and evaluator red flags."
          />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <TLProposalFileSelector
              files={attachments}
              selectedIds={selectedFileIds}
              onChange={setSelectedFileIds}
              tenderId={tenderId}
            />

            <TLBidReviewScoreCard
              review={selected}
              loading={running}
              disabled={!hasProposalFiles || isRunning(selected)}
              onRun={() => void runReview()}
              onRerun={() => void rerunReview()}
            />

            {selected?.status === "COMPLETED" ? (
              <TLBidReviewSummary review={selected} />
            ) : null}

            {groups.length ? (
              <div className="space-y-4">
                {groups.map((group) => (
                  <TLBidReviewFindingGroup
                    key={group.category}
                    category={group.category}
                    findings={group.findings}
                    onEvidence={setEvidenceFinding}
                  />
                ))}
              </div>
            ) : selected?.status === "COMPLETED" ? (
              <TLInlineAlert
                variant="success"
                title="No major bid review findings"
                description="The reviewer did not detect major unanswered requirements, evidence gaps, pricing risks, or evaluator red flags."
              />
            ) : null}
          </div>

          <TLBidReviewHistory
            reviews={reviews}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
        </div>
      </TLSection>

      <TLBidReviewEvidenceDrawer
        finding={evidenceFinding}
        onClose={() => setEvidenceFinding(null)}
      />
    </TenderLensAppShell>
  );
}
