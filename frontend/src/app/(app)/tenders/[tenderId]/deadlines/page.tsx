"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLDeadlinesCard } from "@/components/tenderlens/deadlines-card";
import { ChevronLeft } from "lucide-react";

export default function TenderDeadlinesPage() {
  const params = useParams();
  const tenderId = String(params.tenderId);

  return (
    <TenderLensAppShell
      title={`Tender ${tenderId.slice(0, 8)}`}
      subtitle="Deadlines"
      description="Extracted dates and contact information from the tender documents."
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
        <TLDeadlinesCard tenderId={tenderId} />
      </TLSection>
    </TenderLensAppShell>
  );
}
