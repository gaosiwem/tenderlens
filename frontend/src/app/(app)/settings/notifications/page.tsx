"use client";

import * as React from "react";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { getMyPrefs, updateMyPrefs } from "@/lib/preferences.api";
import type { NotificationPrefs } from "@/lib/preferences.types";
import { TLSmsVerifyPanel } from "@/components/tenderlens/sms-verify-panel";
import { useUsage } from "@/hooks/use-usage";
import {
  Bell,
  Mail,
  Clock,
  ListChecks,
  Save,
  RefreshCcw,
} from "lucide-react";

const EVENT_TYPES = [
  { value: "TENDER_CHANGED", label: "Tender changes" },
  { value: "DEADLINE_CHANGED", label: "Deadline updates" },
  { value: "SUMMARY_CREATED", label: "New AI summaries" },
  { value: "ALERT_FIRED", label: "Reminders and alerts" },
];

export default function NotificationSettingsPage() {
  const { usage } = useUsage();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [prefs, setPrefs] = React.useState<NotificationPrefs | null>(null);

  async function load() {
    setLoading(true);
    const res = await getMyPrefs();
    setLoading(false);
    if (!res.ok) {
      toast.error("Failed to load preferences", {
        description: res.error.message,
      });
      setPrefs(null);
      return;
    }
    setPrefs(res.data.prefs);
  }

  React.useEffect(() => {
    load();
  }, []);

  function patch(p: Partial<NotificationPrefs>) {
    setPrefs((prev) => (prev ? { ...prev, ...p } : prev));
  }

  function toggleEvent(t: string) {
    if (!prefs) return;
    const next = prefs.eventTypes.includes(t)
      ? prefs.eventTypes.filter((x) => x !== t)
      : [...prefs.eventTypes, t];
    patch({ eventTypes: next });
  }

  async function save() {
    if (!prefs) return;
    setSaving(true);
    const res = await updateMyPrefs({
      emailEnabled: prefs.emailEnabled,
      whatsappEnabled: prefs.whatsappEnabled,
      whatsappNumber: prefs.whatsappNumber,
      eventTypes: prefs.eventTypes,
      quietStart: prefs.quietStart,
      quietEnd: prefs.quietEnd,
      digestMode: prefs.digestMode,
    });
    setSaving(false);

    if (!res.ok) {
      toast.error("Failed to save", { description: res.error.message });
      return;
    }

    setPrefs(res.data.prefs);
    toast.success("Preferences updated", {
      description: "Your changes have been saved successfully.",
    });
  }

  return (
    <TenderLensAppShell
      title="Settings"
      subtitle="Notifications"
      description="Manage how and when you receive updates about the tenders you follow."
    >
      <TLSection
        right={
          <div className="flex items-center gap-2">
            <TLButton
              variant="secondary"
              size="sm"
              onClick={load}
              loading={loading}
              iconLeft={<RefreshCcw className="h-4 w-4" />}
            >
              Refresh
            </TLButton>
            <TLButton
              size="sm"
              onClick={save}
              loading={saving || loading}
              iconLeft={<Save className="h-4 w-4" />}
            >
              Update Preferences
            </TLButton>
          </div>
        }
      >
        {!prefs && !loading ? (
          <TLInlineAlert
            title="Unable to load preferences"
            description="Please check your connection and refresh the page."
            tone="error"
          />
        ) : null}

        <div className="grid gap-6">
          <Card className="tl-surface border-border/40">
            <CardContent className="p-6 space-y-8">
              {/* Channels Section */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="font-display text-sm font-extrabold flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Delivery Channels
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Choose where you want to receive notifications.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between border border-border/40 rounded-2xl p-4 bg-muted/5">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-blue-500" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          Email Alerts
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                          Primary Channel
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={Boolean(prefs?.emailEnabled)}
                      onCheckedChange={(v) =>
                        patch({ emailEnabled: Boolean(v) })
                      }
                    />
                  </div>

                  {prefs ? (
                    <div className="space-y-2">
                      <TLSmsVerifyPanel
                        prefs={prefs}
                        disabled={usage?.limits.whatsappEnabled === false}
                        onPatch={(p) => patch(p)}
                        onReloadPrefs={load}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Event Types Section */}
              <div className="space-y-4 pt-4 border-t border-border/40">
                <div className="space-y-1">
                  <div className="font-display text-sm font-extrabold flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-primary" />
                    Interested Events
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select which types of updates trigger a notification.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => toggleEvent(t.value)}
                      className={`px-4 py-2 rounded-xl transition-all text-xs font-semibold border ${
                        prefs?.eventTypes?.includes(t.value)
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground italic pl-1">
                  If none are selected, you will receive all event types by
                  default.
                </p>
              </div>

              {/* Quiet Hours & Digest Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/40">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="font-display text-sm font-extrabold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Quiet Hours
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Defer non-critical alerts during these windows.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                        From
                      </div>
                      <Input
                        className="h-10 bg-background/50"
                        value={prefs?.quietStart ?? ""}
                        onChange={(e) => patch({ quietStart: e.target.value })}
                        placeholder="22:00"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                        Until
                      </div>
                      <Input
                        className="h-10 bg-background/50"
                        value={prefs?.quietEnd ?? ""}
                        onChange={(e) => patch({ quietEnd: e.target.value })}
                        placeholder="06:00"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="font-display text-sm font-extrabold flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      Digest Mode
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Batch your alerts into a single daily summary.
                    </p>
                  </div>

                  <div className="flex items-center justify-between border border-border/40 rounded-2xl p-4 bg-muted/5">
                    <div>
                      <div className="text-sm font-semibold">
                        Daily Email Digest
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Batch 24h of history into one report.
                      </div>
                    </div>
                    <Switch
                      checked={Boolean(prefs?.digestMode)}
                      onCheckedChange={(v) => patch({ digestMode: Boolean(v) })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <TLInlineAlert
            title="Why use preferences?"
            description="TenderLens monitors thousands of changes daily. Using quiet hours and daily digests helps prevent notification fatigue while ensuring you never miss a critical bid deadline."
            tone="neutral"
          />
        </div>
      </TLSection>
    </TenderLensAppShell>
  );
}
