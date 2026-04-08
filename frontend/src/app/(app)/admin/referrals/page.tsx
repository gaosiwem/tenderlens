"use client";

import * as React from "react";
import { toast } from "sonner";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import {
  getReferralSummary,
  type ReferralSummaryItem,
} from "@/lib/referrals.api";
import { markEarningPaid } from "@/lib/referral-payouts.api";

export default function AdminReferralsPage() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<ReferralSummaryItem[]>([]);

  async function load() {
    setLoading(true);
    const r = await getReferralSummary();
    setLoading(false);
    if (!r.ok) {
      toast.error("Failed to load referrals", { description: r.error.message });
      return;
    }
    setItems(r.data.items ?? []);
  }

  React.useEffect(() => {
    load();
  }, []);

  async function markPaid(id: string) {
    const r = await markEarningPaid(id);
    if (!r.ok) {
      toast.error("Failed to mark as paid", { description: r.error.message });
      return;
    }
    toast.success("Marked earning as paid");
    load();
  }

  return (
    <div className="space-y-6">
      <TLSection
        title="Referrals"
        description="Attributions and manual payout marking."
      >
        {loading ? (
          <div className="text-sm text-muted-foreground animate-pulse">
            Loading...
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground bg-muted/30">
            No referral attributions found.
          </div>
        ) : null}

        {items.length > 0 && (
          <div className="overflow-auto border rounded-2xl bg-background">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
                    Created
                  </th>
                  <th className="text-left p-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
                    Code
                  </th>
                  <th className="text-left p-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
                    Billing Ref
                  </th>
                  <th className="text-left p-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
                    Status
                  </th>
                  <th className="text-right p-4 font-bold uppercase tracking-widest text-[10px] text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((r, idx: number) => (
                  <tr
                    key={r.id || idx}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-4">
                      {r.createdAt
                        ? new Date(r.createdAt).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="p-4">
                      <code className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                        {r.code ?? "-"}
                      </code>
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {r.billingReference ?? "-"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          r.status === "PAID"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        }`}
                      >
                        {r.status ?? "PENDING"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {r.status !== "PAID" ? (
                        <TLButton
                          variant="secondary"
                          size="sm"
                          onClick={() => markPaid(r.id)}
                          className="text-[10px] py-1 h-auto"
                        >
                          Mark paid
                        </TLButton>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic font-medium">
                          Paid
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TLSection>
    </div>
  );
}
