"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { TLButton } from "@/components/tenderlens/button";
import { Handshake } from "lucide-react";
import type { Partner } from "@/lib/partners.api";
import { createPartnerReferralCode } from "@/lib/partners.api";

export function TLPartnerCard(props: { partner: Partner }) {
  const [loading, setLoading] = React.useState(false);
  const [code, setCode] = React.useState<string | null>(null);

  async function generate() {
    setLoading(true);
    const r = await createPartnerReferralCode();
    setLoading(false);
    if (!r.ok) {
      toast.error("Failed", { description: (r.error as any).message });
      return;
    }
    setCode(r.data.code);
    toast.success("Referral code created");
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard");
  }

  return (
    <Card className="tl-surface border-primary/20 bg-linear-to-b from-background to-muted/20 shadow-2xl shadow-primary/5 overflow-hidden group hover:border-primary/40 transition-all duration-500">
      <CardContent className="p-8 space-y-6 relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Handshake className="size-20" />
        </div>

        <div className="flex justify-between items-start relative z-10">
          <div className="space-y-1">
            <div className="font-display text-xl font-extrabold tracking-tight">
              {props.partner.name}
            </div>
            <div className="text-sm font-medium text-muted-foreground/60 tracking-tight">
              {props.partner.email}
            </div>
          </div>
          <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.15em] border border-primary/20 backdrop-blur-md">
            {props.partner.tier?.name ?? "Standard Partner"}
          </div>
        </div>

        <div className="pt-4 border-t border-border/40 relative z-10">
          <div className="text-[10px] text-muted-foreground/50 uppercase font-bold tracking-[0.2em] mb-2">
            Revenue Share
          </div>
          <div className="text-3xl font-display font-extrabold text-primary">
            {props.partner.tier?.revenueSharePercent ?? 10}%
          </div>
        </div>

        <div className="flex flex-col gap-4 py-4 relative z-10">
          {!code ? (
            <TLButton
              onClick={generate}
              disabled={loading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-bold"
            >
              {loading ? "Initializing..." : "Generate Referral Code"}
            </TLButton>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="text-[10px] text-muted-foreground/50 uppercase font-bold tracking-[0.2em]">
                Your Active Tracking Code
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted/30 backdrop-blur-md p-4 rounded-2xl border border-border/60 font-mono font-extrabold text-center tracking-[0.25em] text-xl shadow-inner group-hover:border-primary/20 transition-colors">
                  {code}
                </div>
                <TLButton
                  variant="secondary"
                  onClick={copy}
                  className="h-14 px-6 rounded-2xl border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-90"
                >
                  Copy
                </TLButton>
              </div>
            </div>
          )}
        </div>

        <div className="text-[10px] text-muted-foreground/40 italic leading-relaxed border-t border-border/40 pt-4">
          Earnings are attributed based on tracked Stripe operations using your
          unique identifier. Payouts are finalized according to your master
          agreement terms.
        </div>
      </CardContent>
    </Card>
  );
}
