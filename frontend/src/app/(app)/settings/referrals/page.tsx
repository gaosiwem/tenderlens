"use client";

import * as React from "react";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { generateReferralCode } from "@/lib/referrals.api";

export default function ReferralsPage() {
  const [code, setCode] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function gen() {
    setLoading(true);
    const r = await generateReferralCode();
    setLoading(false);
    if (!r.ok) {
      toast.error("Failed", { description: r.error.message });
      return;
    }
    setCode(r.data.code);
    toast.success("Referral code generated");
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Copied");
  }

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Settings">
      <TLSection
        title="Referrals"
        description="Share a referral code. Attribution v1."
      >
        <div className="border border-border rounded-2xl p-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            Generate a referral code and share it with another team. When they
            upgrade, it can be attributed to you.
          </div>

          <div className="flex flex-wrap gap-2">
            <TLButton onClick={gen} disabled={loading}>
              {loading ? "Generating..." : "Generate code"}
            </TLButton>
            {code ? (
              <TLButton variant="secondary" onClick={copy}>
                Copy
              </TLButton>
            ) : null}
          </div>

          {code ? (
            <div className="border border-border rounded-xl p-3 text-sm font-semibold tracking-wide">
              {code}
            </div>
          ) : null}
        </div>
      </TLSection>
    </TenderLensAppShell>
  );
}
