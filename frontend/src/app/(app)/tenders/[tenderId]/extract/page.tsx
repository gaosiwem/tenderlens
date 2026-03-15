"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TextViewer } from "@/components/tenderlens/text-viewer";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { TLSpendGuardAlert } from "@/components/tenderlens/spend-guard-alert";
import { apiFetch } from "@/lib/api";
import type { TenderExtract, Tender } from "@/lib/tenders.types";
import { Skeleton } from "@/components/ui/skeleton";

export default function ExtractViewerPage() {
  const params = useParams();
  const router = useRouter();
  const tenderId = params.tenderId as string;

  const [extract, setExtract] = React.useState<TenderExtract | null>(null);
  const [tender, setTender] = React.useState<Tender | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([
      apiFetch<Tender>(`/api/v1/tenders/${tenderId}`),
      apiFetch<TenderExtract>(`/api/v1/tenders/${tenderId}/extract`),
    ])
      .then(([tRes, eRes]) => {
        if (tRes.ok) setTender(tRes.data);
        if (eRes.ok) {
          setExtract(eRes.data);
        } else {
          setError(eRes.error.message || "Failed to load extract");
        }
      })
      .catch(() => setError("Network error occurred"))
      .finally(() => setLoading(false));
  }, [tenderId]);

  if (loading) {
    return (
      <TenderLensAppShell title={<Skeleton className="h-8 w-64" />}>
        <TLSection>
          <Skeleton className="h-[60vh] w-full" />
        </TLSection>
      </TenderLensAppShell>
    );
  }

  if (error || !extract) {
    return (
      <TenderLensAppShell title="Error">
        <TLSection>
          <TLInlineAlert variant="error" title="Could not load extract">
            {error ||
              "Extract not found. The processing might have failed or is still in progress."}
          </TLInlineAlert>
          <TLButton
            variant="outline"
            className="mt-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="size-4 mr-2" />
            Go Back
          </TLButton>
        </TLSection>
      </TenderLensAppShell>
    );
  }

  const billing = (extract.meta as any)?.billing;
  const ocrSkipped = billing?.ocr?.skipped;
  const embedSkipped = billing?.embeddings?.skipped;

  return (
    <TenderLensAppShell
      title="Extracted Text"
      description={`Viewing extracted content for: ${tender?.title || tenderId}`}
      actions={
        <div className="flex gap-2">
          <TLButton variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Tender
          </TLButton>
          <TLButton
            onClick={() => {
              const blob = new Blob([extract.text], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `extract-${tenderId}.txt`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="size-4 mr-2" />
            Download .txt
          </TLButton>
        </div>
      }
    >
      <TLSection>
        {ocrSkipped ? (
          <div className="mb-6">
            <TLInlineAlert
              title="OCR skipped"
              description="OCR was skipped by configuration or processing limits."
              tone="warning"
            />
          </div>
        ) : null}

        {embedSkipped ? (
          <div className="mb-6">
            <TLInlineAlert
              title="Embeddings skipped"
              description="Embeddings were skipped by configuration or processing limits."
              tone="warning"
            />
          </div>
        ) : null}

        <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <FileText className="size-4" />
            <span>{extract.text.length.toLocaleString()} characters</span>
          </div>
          {extract.pageCount && <div>• {extract.pageCount} pages</div>}
          {extract.language && <div>• {extract.language}</div>}
        </div>
        <TextViewer text={extract.text} />
      </TLSection>
    </TenderLensAppShell>
  );
}
