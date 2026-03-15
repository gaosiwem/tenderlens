"use client";

import * as React from "react";
import { Minus, Plus, Users } from "lucide-react";

export function TLSeatSelector(props: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const min = props.min ?? 1;
  const max = props.max ?? 100;

  function set(n: number) {
    const x = Math.max(min, Math.min(max, n));
    props.onChange(x);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Users className="w-3 h-3" />
        <span>Seats</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center bg-background border border-border rounded-xl p-1">
          <button
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
            onClick={() => set(props.value - 1)}
            disabled={props.value <= min}
          >
            <Minus className="w-4 h-4" />
          </button>

          <input
            className="w-12 text-center bg-transparent border-none text-sm font-medium focus:ring-0"
            value={String(props.value)}
            onChange={(e) => set(parseInt(e.target.value || "1", 10))}
            inputMode="numeric"
          />

          <button
            className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
            onClick={() => set(props.value + 1)}
            disabled={props.value >= max}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-muted-foreground leading-tight">
          Total team members who will have access to the platform.
        </div>
      </div>
    </div>
  );
}
