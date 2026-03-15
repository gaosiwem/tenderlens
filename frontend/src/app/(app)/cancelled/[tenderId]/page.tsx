"use client";

import { useParams } from "next/navigation";
import { LifecycleTenderDetail } from "@/components/tenderlens/lifecycle-tender-detail";

export default function CancelledTenderDetailPage() {
  const params = useParams();
  const tenderId = params.tenderId as string;

  return (
    <LifecycleTenderDetail
      tenderId={tenderId}
      lifecycle="cancelled"
      shellTitle="Cancelled Tender"
      detailTitle="Cancelled Tender Details"
      description="View cancellation intelligence, republish candidates, and supporting documents."
      backHref="/cancelled"
      backLabel="Back to Cancelled"
    />
  );
}
