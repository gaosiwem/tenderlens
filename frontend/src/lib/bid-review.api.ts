import { apiFetch } from "@/lib/api";
import type { BidReview } from "@/lib/bid-review.types";

export async function startBidReview(
  tenderId: string,
  proposalFileIds?: string[],
) {
  return apiFetch<{ review: BidReview }>(
    `/api/v1/tenders/${tenderId}/bid-reviews`,
    {
      method: "POST",
      body: JSON.stringify({ proposalFileIds }),
    },
  );
}

export async function listBidReviews(tenderId: string) {
  return apiFetch<{ items: BidReview[] }>(
    `/api/v1/tenders/${tenderId}/bid-reviews`,
    { method: "GET" },
  );
}

export async function getBidReview(reviewId: string) {
  return apiFetch<{ review: BidReview }>(`/api/v1/bid-reviews/${reviewId}`, {
    method: "GET",
  });
}

export async function rerunBidReview(reviewId: string) {
  return apiFetch<{ review: BidReview }>(
    `/api/v1/bid-reviews/${reviewId}/rerun`,
    { method: "POST" },
  );
}
