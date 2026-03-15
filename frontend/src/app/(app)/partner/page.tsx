"use client";

import * as React from "react";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { getPartnerMe } from "@/lib/partners.api";
import { TLPartnerCard } from "@/components/tenderlens/partner-card";

export default function PartnerPage() {
  const [loading, setLoading] = React.useState(true);
  const [partner, setPartner] = React.useState<any | null>(null);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await getPartnerMe();
      setLoading(false);
      if (!r.ok) {
        toast.error("Failed", { description: (r.error as any).message });
        return;
      }
      setPartner(r.data.partner);
    })();
  }, []);

  return (
    <TenderLensAppShell title="TenderLens" subtitle="Partner">
      <div className="max-w-4xl mx-auto py-6 px-4 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <header className="relative py-16 px-10 rounded-[3rem] bg-linear-to-br from-primary via-primary/90 to-primary/70 text-white overflow-hidden shadow-2xl shadow-primary/30 group">
          {/* Animated Background Elements */}
          <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-12 -translate-y-12 transition-transform duration-700 group-hover:scale-110">
            <div className="w-80 h-80 rounded-full border-[32px] border-white" />
          </div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-white/10 blur-3xl" />

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 text-[10px] font-bold uppercase tracking-[0.2em] backdrop-blur-xl border border-white/20 transition-all hover:bg-white/25">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              Partner Program
            </div>
            <h1 className="text-5xl font-display font-extrabold tracking-tight drop-shadow-sm">
              Earning with <span className="text-white/90">TenderLens</span>
            </h1>
            <p className="text-white/70 text-base max-w-lg leading-relaxed font-medium">
              Attributing growth together. Use your unique referral code to
              track revenue and earn based on your tier agreements.
            </p>
          </div>
        </header>

        <div className="max-w-xl mx-auto w-full">
          <TLSection
            title="Account Status"
            description="Manage your partner profile and generate attribution links."
            className="animate-in fade-in fill-mode-both delay-300 duration-1000"
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center p-20 gap-4">
                <div className="relative h-12 w-12">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 animate-pulse">
                  Authenticating Partner...
                </div>
              </div>
            ) : null}

            {!loading && !partner ? (
              <div className="border-2 border-dashed border-border/50 rounded-[2rem] p-20 text-center bg-muted/10 backdrop-blur-sm transition-all hover:bg-muted/20 hover:border-primary/20 group">
                <div className="inline-flex p-4 rounded-2xl bg-muted/50 text-muted-foreground/40 mb-6 group-hover:scale-110 transition-transform">
                  <svg
                    className="size-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="text-base font-display font-extrabold text-muted-foreground italic">
                  No Partner Profile Found
                </div>
                <p className="text-sm text-muted-foreground/50 mt-3 max-w-xs mx-auto leading-relaxed">
                  Your account is not currently linked to our partner network.
                  Contact our growth team to apply.
                </p>
              </div>
            ) : null}

            {partner ? <TLPartnerCard partner={partner} /> : null}
          </TLSection>
        </div>
      </div>
    </TenderLensAppShell>
  );
}
