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
import { apiFetch } from "@/lib/api";
import {
  generateChecklist,
  getChecklist,
  updateChecklistItems,
} from "@/lib/checklist.api";
import { listOrgBusinessDocs } from "@/lib/org-docs.api";
import { TLChecklistView } from "@/components/tenderlens/checklist-view";
import { TLPaywallGuard } from "@/components/tenderlens/paywall-guard";
import type { Tender } from "@/lib/tenders.types";
import type { BidChecklistDoc, ChecklistItem } from "@/lib/checklist.types";
import { RefreshCw } from "lucide-react";

function formatChecklistTitle(rawTitle: string | null | undefined) {
  const title = (rawTitle ?? "").trim();
  if (!title) return "Bid checklist";

  const cleaned = title
    .replace(/\bfor\s+(?:the\s+)?(?:tender\s+)?title\b\s*[:\-]?\s*/gi, "for ")
    .replace(/^title\s*[:\-]?\s*/i, "")
    .replace(/\btitle\s*[:\-]\s*/gi, "")
    .replace(/\bfor\s*[:\-]\s*/gi, "for ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  return cleaned || "Bid checklist";
}

function withCheckedDefaults(items: ChecklistItem[] | null | undefined) {
  return (items ?? []).map((item) => ({
    ...item,
    checked: Boolean(item.checked),
    notes: String(item.notes ?? ""),
  }));
}

export default function TenderChecklistPage() {
  const params = useParams();
  const tenderId = String(params.tenderId);

  const [loading, setLoading] = React.useState(true);
  const [doc, setDoc] = React.useState<BidChecklistDoc | null>(null);
  const [items, setItems] = React.useState<ChecklistItem[]>([]);
  const [savingByIndex, setSavingByIndex] = React.useState<Record<number, boolean>>(
    {},
  );
  const [tenderTitle, setTenderTitle] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);

  const [orgDocsStatus, setOrgDocsStatus] = React.useState<
    "loading" | "ready" | "processing" | "none"
  >("loading");
  const [orgDocsCount, setOrgDocsCount] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [res, tenderRes] = await Promise.all([
      getChecklist(tenderId),
      apiFetch<Tender>(`/api/v1/tenders/${tenderId}`),
    ]);
    setLoading(false);

    if (tenderRes.ok) {
      const value = tenderRes.data.title?.trim();
      setTenderTitle(value || null);
    }

    if (!res.ok) {
      if (res.error.code === "NOT_FOUND") {
        setDoc(null);
        setItems([]);
        return;
      }
      toast.error("Failed to load checklist", {
        description: res.error.message,
      });
      setDoc(null);
      setItems([]);
      return;
    }
    setDoc(res.data);
    setItems(withCheckedDefaults(res.data.checklist));
  }, [tenderId]);

  const loadOrgDocsStatus = React.useCallback(async () => {
    const res = await listOrgBusinessDocs();
    if (!res.ok) return;
    setOrgDocsCount(res.data.items.length);
    if (res.data.processing) setOrgDocsStatus("processing");
    else if (res.data.ready) setOrgDocsStatus("ready");
    else setOrgDocsStatus("none");
  }, []);

  React.useEffect(() => {
    void load();
    void loadOrgDocsStatus();
  }, [load, loadOrgDocsStatus]);

  async function generate(force = true) {
    setGenerating(true);
    const res = await generateChecklist(tenderId, force);
    setGenerating(false);

    if (!res.ok) {
      toast.error("Failed to generate checklist", {
        description: res.error.message,
      });
      return;
    }

    setDoc(res.data);
    setItems(withCheckedDefaults(res.data.checklist));
    toast.success("Checklist ready");
  }

  async function persistChecklist(
    nextItems: ChecklistItem[],
    index: number,
    rollbackItems?: ChecklistItem[],
  ) {
    setSavingByIndex((prev) => ({ ...prev, [index]: true }));
    const res = await updateChecklistItems(tenderId, nextItems);
    setSavingByIndex((prev) => {
      const out = { ...prev };
      delete out[index];
      return out;
    });

    if (!res.ok) {
      if (rollbackItems) setItems(rollbackItems);
      toast.error("Failed to save checklist", {
        description: res.error.message,
      });
      return false;
    }

    setDoc(res.data);
    setItems(withCheckedDefaults(res.data.checklist));
    return true;
  }

  async function handleToggleItem(index: number, checked: boolean) {
    if (!items[index]) return;

    const previousItems = items;
    const nextItems = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, checked } : item,
    );

    setItems(nextItems);
    await persistChecklist(nextItems, index, previousItems);
  }

  async function handleSaveNote(index: number, notes: string) {
    if (!items[index]) return false;
    const normalizedNotes = notes.trim();
    const previousItems = items;

    const nextItems = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, notes: normalizedNotes } : item,
    );
    setItems(nextItems);
    return persistChecklist(nextItems, index, previousItems);
  }

  const title = tenderTitle
    ? `Bid Submission Checklist for ${tenderTitle}`
    : formatChecklistTitle(doc?.title);

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Tender">
      <TLPaywallGuard>
        {({ run: guardRun }) => (
          <TLSection
            title="Bid checklist"
            description="Actionable tasks to prepare your submission using your uploaded business documents."
            right={
              <div className="flex items-center gap-2">
                <Link href="/settings/org-docs">
                  <TLButton variant="outline">Business docs</TLButton>
                </Link>
                <Link href={`/tenders/${tenderId}`}>
                  <TLButton variant="secondary">Back to tender</TLButton>
                </Link>
                <TLButton
                  variant="secondary"
                  onClick={() =>
                    guardRun(() => generate(true), {
                      title: "Checklist Requires Pro",
                      description:
                        "Upgrade to Pro to generate AI-powered preparation checklists for your bids.",
                    })
                  }
                  loading={generating}
                  disabled={loading}
                >
                  <RefreshCw className="mr-2 size-4" />
                  Refresh
                </TLButton>
              </div>
            }
          >
            {orgDocsStatus === "none" && (
              <TLInlineAlert
                variant="warning"
                title="No business documents uploaded"
              >
                Upload your company profile, certifications, and registration
                documents so the AI can assess whether you are eligible for this
                tender.{" "}
                <Link
                  href="/settings/org-docs"
                  className="underline font-semibold hover:text-primary"
                >
                  Upload now
                </Link>
              </TLInlineAlert>
            )}
            {orgDocsStatus === "processing" && (
              <TLInlineAlert
                variant="info"
                title="Business documents processing"
              >
                Your {orgDocsCount} uploaded document
                {orgDocsCount !== 1 ? "s are" : " is"} still being extracted.
                Checklist quality will improve once processing completes.
              </TLInlineAlert>
            )}
            {orgDocsStatus === "ready" && (
              <TLInlineAlert
                variant="success"
                title="Business document context active"
              >
                {orgDocsCount} business document{orgDocsCount !== 1 ? "s" : ""}{" "}
                loaded. The AI is using your company profile for checklist
                analysis.
              </TLInlineAlert>
            )}

            {loading ? (
              <TLCardSkeleton />
            ) : items.length > 0 ? (
              <TLChecklistView
                title={title}
                items={items}
                onToggleItem={handleToggleItem}
                onSaveNote={handleSaveNote}
                savingByIndex={savingByIndex}
              />
            ) : (
              <div className="flex flex-col items-center justify-center border border-border rounded-2xl p-12 bg-background/20">
                <div className="text-sm text-muted-foreground mb-4">
                  No checklist generated yet.
                </div>
                {doc === null && (
                  <TLButton
                    onClick={() =>
                      guardRun(() => generate(true), {
                        title: "Checklist Requires Pro",
                        description:
                          "Upgrade to Pro to generate AI-powered preparation checklists for your bids.",
                      })
                    }
                    loading={generating}
                  >
                    Generate checklist
                  </TLButton>
                )}
              </div>
            )}
          </TLSection>
        )}
      </TLPaywallGuard>
    </TenderLensAppShell>
  );
}
