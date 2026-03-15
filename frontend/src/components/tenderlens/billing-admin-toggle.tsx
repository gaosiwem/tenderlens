"use client";

import * as React from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { setBillingAdmin } from "@/lib/members.api";

export function TLBillingAdminToggle(props: {
  userId: string;
  value: boolean;
  disabled?: boolean;
  onChanged: () => Promise<void>;
}) {
  const [saving, setSaving] = React.useState(false);

  async function toggle() {
    if (props.disabled) return;
    setSaving(true);
    const res = await setBillingAdmin(props.userId, !props.value);
    if (!res.ok) {
      toast.error("Update failed", { description: res.error.message });
      setSaving(false);
      return;
    }

    await props.onChanged();
    toast.success(
      props.value ? "Billing admin removed" : "Billing admin assigned",
    );
    setSaving(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={props.disabled || saving}
      className={`relative group flex items-center gap-2 px-3.5 py-1.5 rounded-xl border transition-all duration-200 text-xs font-bold uppercase tracking-wider h-9 ${
        props.value
          ? "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
          : "bg-background border-border hover:border-muted-foreground/30 text-muted-foreground hover:text-foreground"
      } ${props.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {saving ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : props.value ? (
        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
      ) : (
        <ShieldAlert className="w-3.5 h-3.5 group-hover:text-foreground transition-colors" />
      )}

      <span>{props.value ? "Billing Admin" : "Grant Billing Role"}</span>
    </button>
  );
}
