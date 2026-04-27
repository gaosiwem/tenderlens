"use client";

import * as React from "react";
import Link from "next/link";
import { TLButton } from "@/components/tenderlens/button";
import type { UpgradeOffer } from "@/lib/offers.api";
import { Sparkles } from "lucide-react";

export function TLUpgradeOfferBanner(props: {
  offer: UpgradeOffer;
  onTrack: (
    name: "impression" | "click" | "accept" | "dismiss",
  ) => Promise<void> | void;
}) {
  const tracked = React.useRef(false);

  React.useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    props.onTrack("impression");
  }, [props]);

  const expiresInHours = Math.max(
    0,
    Math.round(
      (new Date(props.offer.expiresAt).getTime() - Date.now()) / 3600000,
    ),
  );

  return (
    <div className="relative overflow-hidden border border-primary/20 rounded-3xl p-6 bg-linear-to-r from-primary/10 via-background/40 to-background/20 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 shadow-2xl shadow-primary/5 group transition-all duration-500 hover:border-primary/40 hover:shadow-primary/10">
      {/* Decorative Glow elements */}
      <div className="absolute top-0 left-0 w-1.5 h-full bg-linear-to-b from-primary via-primary/80 to-primary/40" />
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 blur-3xl rounded-full group-hover:bg-primary/20 transition-colors" />

      <div className="flex items-start gap-4 relative z-10">
        <div className="mt-1 p-3 rounded-2xl bg-primary/10 text-primary shadow-inner border border-primary/5 transition-transform group-hover:scale-110 duration-500">
          <Sparkles className="size-5 animate-pulse" />
        </div>
        <div className="space-y-1">
          <div className="font-display font-extrabold text-lg tracking-tight text-foreground/90">
            {props.offer.title}
          </div>
          <div className="text-sm text-muted-foreground/80 leading-relaxed max-w-lg font-medium">
            {props.offer.description}
          </div>
          <div className="flex items-center gap-2.5 mt-3">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </div>
            <span className="text-[10px] text-primary font-bold tracking-[0.15em]">
              Exclusive offer · Expires in {expiresInHours}h
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 relative z-10">
        <Link
          href="/settings/billing"
          onClick={() => props.onTrack("click")}
          className="flex-1 sm:flex-none"
        >
          <TLButton
            onClick={() => props.onTrack("accept")}
            className="w-full sm:w-auto h-11 px-8 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all active:scale-95 text-white font-bold tracking-tight"
          >
            {props.offer.ctaLabel}
          </TLButton>
        </Link>
        <TLButton
          variant="ghost"
          size="sm"
          onClick={() => props.onTrack("dismiss")}
          className="text-xs font-bold tracking-widest text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 px-4"
        >
          Maybe later
        </TLButton>
      </div>
    </div>
  );
}
