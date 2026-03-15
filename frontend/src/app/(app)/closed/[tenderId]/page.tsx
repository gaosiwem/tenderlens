"use client";

import { useParams } from "next/navigation";
import { LifecycleTenderDetail } from "@/components/tenderlens/lifecycle-tender-detail";

export default function ClosedTenderDetailPage() {
  const params = useParams();
  const tenderId = params.tenderId as string;

  return (
    <LifecycleTenderDetail
      tenderId={tenderId}
      lifecycle="closed"
      shellTitle="Closed Tender"
      detailTitle="Closed Tender Details"
      description="View post-close intelligence, follow-up signals, and supporting documents."
      backHref="/closed"
      backLabel="Back to Closed"
    />
  );
}
