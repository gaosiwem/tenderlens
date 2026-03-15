"use client";

import { useParams } from "next/navigation";
import { LifecycleTenderDetail } from "@/components/tenderlens/lifecycle-tender-detail";

export default function AwardedTenderDetailPage() {
  const params = useParams();
  const tenderId = params.tenderId as string;

  return (
    <LifecycleTenderDetail
      tenderId={tenderId}
      lifecycle="awarded"
      shellTitle="Awarded Tender"
      detailTitle="Awarded Tender Details"
      description="View award intelligence, related tenders, and supporting documents."
      backHref="/awarded"
      backLabel="Back to Awarded"
    />
  );
}
