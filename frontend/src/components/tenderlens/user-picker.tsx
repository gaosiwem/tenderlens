"use client";

import * as React from "react";
import { useOrgMembers } from "@/hooks/use-org-members";
import type { OrgMember } from "@/lib/org.types";

interface TLUserPickerProps {
  value: string | null;
  onChange: (userId: string | null) => void;
}

export function TLUserPicker(props: TLUserPickerProps) {
  const { loading, items } = useOrgMembers();

  // Find current user's name if value is set but items not loaded yet?
  // Actually we rely on items.

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold tracking-wide text-muted-foreground ">
        Owner
      </div>
      <div className="relative">
        <select
          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm appearance-none"
          value={props.value ?? ""}
          onChange={(e) => props.onChange(e.target.value || null)}
          disabled={loading}
        >
          <option value="">Unassigned</option>
          {items.map((m: OrgMember) => (
            <option key={m.userId} value={m.userId}>
              {m.name || m.email || "Unknown User"}
            </option>
          ))}
        </select>
        {/* Simple chevron icon could be added here for better UI, but native select is fine for Sprint 11 */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
          <svg
            className="h-4 w-4 fill-current"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
          >
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
          </svg>
        </div>
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading members...</div>
      ) : null}
    </div>
  );
}
