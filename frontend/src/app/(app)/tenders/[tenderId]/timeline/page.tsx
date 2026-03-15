"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLTenderTimeline } from "@/components/tenderlens/tender-timeline";
import { ChevronLeft } from "lucide-react";

export default function TenderTimelinePage() {
  const params = useParams();
  const tenderId = String(params.tenderId);

  return (
    <TenderLensAppShell
      title={`Tender ${tenderId.slice(0, 8)}`}
      subtitle="Timeline"
      description="Historical view of all changes, updates, and events related to this tender."
    >
      <TLSection
        right={
          <Link href={`/tenders/${tenderId}`}>
            <TLButton
              variant="secondary"
              size="sm"
              iconLeft={<ChevronLeft className="h-4 w-4" />}
            >
              Back to Tender
            </TLButton>
          </Link>
        }
      >
        <TLTenderTimeline tenderId={tenderId} />
      </TLSection>
    </TenderLensAppShell>
  );
}
