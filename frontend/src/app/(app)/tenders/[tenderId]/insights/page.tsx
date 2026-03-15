"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { TLCardSkeleton } from "@/components/tenderlens/skeleton-blocks";
import { TLKeyValueGrid } from "@/components/tenderlens/key-value-grid";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import { apiFetch } from "@/lib/api";
import type { Tender } from "@/lib/tenders.types";
import type { TenderInsightsResponse } from "@/lib/search.types";

function toList(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  return [String(v)];
}

export default function InsightsPage() {
  const params = useParams();
  const tenderId = String(params.tenderId);

  const [loading, setLoading] = React.useState(true);
  const [tender, setTender] = React.useState<Tender | null>(null);
  const [insights, setInsights] = React.useState<any | null>(null);
  const [createdAt, setCreatedAt] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);

    const t = await apiFetch<Tender>(`/api/v1/tenders/${tenderId}`, {
      method: "GET",
    });
    if (!t.ok) {
      setLoading(false);
      toast.error("Failed to load tender", { description: t.error.message });
      return;
    }

    const i = await apiFetch<TenderInsightsResponse>(
      `/api/v1/tenders/${tenderId}/insights`,
      { method: "GET" },
    );
    setLoading(false);

    setTender(t.data);
    if (!i.ok) {
      setInsights(null);
      toast.error("Failed to load insights", { description: i.error.message });
      return;
    }

    const baseline = i.data.items.find((r) => r.kind === "baseline");
    setInsights(baseline?.data ?? null);
    setCreatedAt(baseline?.createdAt ?? null);
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenderId]);

  if (loading && !insights) {
    return (
      <TenderLensAppShell title="TenderLens" subtitle="Insights">
        <TLCardSkeleton />
      </TenderLensAppShell>
    );
  }

  const emails = toList(insights?.contacts?.emails);
  const phones = toList(insights?.contacts?.phones);
  const dates = toList(insights?.hints?.dates);
  const money = toList(insights?.hints?.money);
  const keywords = toList(insights?.hints?.keywords);

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Insights">
      <TLSection
        title={tender?.title ? `Insights: ${tender.title}` : "Insights"}
        description="Baseline insights extracted deterministically from text. Not an AI compliance assessment."
        right={
          <div className="flex items-center gap-2">
            {createdAt ? (
              <TLCodeBadge
                value={`generated ${new Date(createdAt).toLocaleString()}`}
              />
            ) : null}
            <Link href={`/tenders/${tenderId}`}>
              <TLButton variant="secondary">Back</TLButton>
            </Link>
            <TLButton variant="secondary" onClick={load}>
              Refresh
            </TLButton>
          </div>
        }
      >
        {!insights ? (
          <TLInlineAlert
            title="No insights available"
            description="Insights appear after processing completes. Return to tender details to check status."
            tone="warning"
          />
        ) : (
          <div className="grid gap-4">
            <TLKeyValueGrid
              title="Contacts"
              items={[
                {
                  label: "Emails",
                  value: emails.length ? emails.join(", ") : "None found",
                },
                {
                  label: "Phones",
                  value: phones.length ? phones.join(", ") : "None found",
                },
              ]}
            />

            <TLKeyValueGrid
              title="Hints"
              items={[
                {
                  label: "Dates mentioned",
                  value: dates.length ? dates.join(", ") : "None found",
                },
                {
                  label: "Money mentioned",
                  value: money.length ? money.join(", ") : "None found",
                },
              ]}
            />

            <TLKeyValueGrid
              title="Keywords"
              items={[
                {
                  label: "Matched keywords",
                  value: keywords.length ? keywords.join(", ") : "None found",
                },
              ]}
            />
          </div>
        )}
      </TLSection>
    </TenderLensAppShell>
  );
}
