"use client";

import { TLCodeBadge } from "@/components/tenderlens/code-badge";

export function TLDueBadge(props: { dueAt: string | null; status: string }) {
  if (!props.dueAt || props.status === "DONE") return null;

  const due = new Date(props.dueAt).getTime();
  const now = Date.now();
  const hours = (due - now) / 3600000;

  if (hours < 0)
    return (
      <TLCodeBadge
        value="OVERDUE"
        className="bg-destructive/10 text-destructive border-destructive/20"
      />
    );
  if (hours <= 24)
    return (
      <TLCodeBadge
        value="DUE SOON"
        className="bg-amber-500/10 text-amber-600 border-amber-500/20"
      />
    );
  return null;
}
