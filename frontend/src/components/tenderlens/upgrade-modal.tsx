"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TLButton } from "@/components/tenderlens/button";
import { Rocket, Users } from "lucide-react";
export function TLUpgradeModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  onUpgrade: () => void;
  ctaLabel?: string;
  variant?: "upgrade" | "seats";
}) {
  const cta =
    props.ctaLabel ||
    (props.variant === "seats" ? "Manage Seats" : "Upgrade to Pro");

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-gradient-to-br from-primary/5 via-background to-background p-8">
          <DialogHeader className="items-center text-center space-y-4">
            <div
              className={`rounded-2xl p-4 shadow-sm border ${
                props.variant === "seats"
                  ? "bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200/50"
                  : "bg-primary/10 text-primary border-primary/10"
              }`}
            >
              {props.variant === "seats" ? (
                <Users className="h-8 w-8" />
              ) : (
                <Rocket className="h-8 w-8" />
              )}
            </div>
            <div className="space-y-2">
              <DialogTitle className="font-display text-2xl font-extrabold tracking-tight">
                {props.title}
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground/80 leading-relaxed">
                {props.description}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="mt-8 flex flex-col gap-3">
            <TLButton
              onClick={props.onUpgrade}
              className="h-12 text-sm font-bold uppercase tracking-widest shadow-lg shadow-primary/20"
            >
              {cta}
            </TLButton>
            <TLButton
              variant="ghost"
              onClick={() => props.onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground text-xs font-bold uppercase tracking-widest h-10"
            >
              Maybe later
            </TLButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
