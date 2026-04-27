"use client";

import * as React from "react";
import { toast } from "sonner";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { TLInlineAlert } from "@/components/tenderlens/inline-alert";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TLTagInput } from "@/components/tenderlens/tag-input";
import {
  listAlertRules,
  createAlertRule,
  updateAlertRule,
  deleteAlertRule,
} from "@/lib/sprint7.api";
import type { AlertRule } from "@/lib/sprint7.types";
import { Switch } from "@/components/ui/switch";

const EVENT_TYPES = [
  { value: "TENDER_CHANGED", label: "Tender changed" },
  { value: "DEADLINE_CHANGED", label: "Deadline changed" },
  { value: "SUMMARY_CREATED", label: "Summary created" },
];

export default function AdminAlertsPage() {
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<AlertRule[]>([]);

  const [name, setName] = React.useState("");
  const [eventTypes, setEventTypes] = React.useState<string[]>([
    "TENDER_CHANGED",
  ]);
  const [tenderId, setTenderId] = React.useState("");
  const [keywords, setKeywords] = React.useState<string[]>([]);
  const [cooldownMin, setCooldownMin] = React.useState("60");
  const [creating, setCreating] = React.useState(false);

  async function load() {
    setLoading(true);
    const res = await listAlertRules();
    setLoading(false);

    if (!res.ok) {
      toast.error("Failed to load rules", { description: res.error.message });
      setItems([]);
      return;
    }
    setItems(res.data.items);
  }

  React.useEffect(() => {
    load();
  }, []);

  function toggleEvent(t: string) {
    setEventTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function create() {
    const nm = name.trim();
    if (!nm) {
      toast.error("Rule name required");
      return;
    }
    const cd = Number(cooldownMin);
    if (!Number.isFinite(cd) || cd < 0) {
      toast.error("Invalid cooldown");
      return;
    }
    if (!eventTypes.length) {
      toast.error("Select at least one event type");
      return;
    }

    setCreating(true);
    const res = await createAlertRule({
      name: nm,
      eventTypes,
      tenderId: tenderId.trim() ? tenderId.trim() : undefined,
      keywords,
      cooldownMin: cd || 60,
    });
    setCreating(false);

    if (!res.ok) {
      toast.error("Failed to create rule", { description: res.error.message });
      return;
    }

    toast.success("Rule created");
    setName("");
    setTenderId("");
    setKeywords([]);
    setCooldownMin("60");
    await load();
  }

  async function setEnabled(rule: AlertRule, enabled: boolean) {
    const res = await updateAlertRule(rule.id, { isEnabled: enabled });
    if (!res.ok) {
      toast.error("Failed to update", { description: res.error.message });
      return;
    }
    toast.success("Updated");
    await load();
  }

  async function remove(rule: AlertRule) {
    const res = await deleteAlertRule(rule.id);
    if (!res.ok) {
      toast.error("Failed to delete", { description: res.error.message });
      return;
    }
    toast.success("Deleted");
    await load();
  }

  return (
    <div className="space-y-6">
      <TLSection
        title="Alert rules"
        description="Rules that trigger email notifications. Keep them conservative to avoid spam."
        right={
          <Button variant="outline" onClick={load} disabled={loading}>
            Refresh
          </Button>
        }
      >
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="text-sm font-bold">Create rule</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground ">
                    Name
                  </div>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Example: High priority tenders"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground ">
                    Tender id (optional)
                  </div>
                  <Input
                    value={tenderId}
                    onChange={(e) => setTenderId(e.target.value)}
                    placeholder="If set, rule applies only to this tender"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold tracking-widest text-muted-foreground ">
                  Event types
                </div>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => toggleEvent(t.value)}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${eventTypes.includes(t.value) ? "border-primary/40 bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Choose what triggers this rule.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground ">
                    Keywords (optional)
                  </div>
                  <TLTagInput
                    value={keywords}
                    onChange={setKeywords}
                    placeholder="Example: mandatory briefing"
                  />
                  <div className="text-[10px] text-muted-foreground">
                    All keywords must match. Leave empty to match all.
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-bold tracking-widest text-muted-foreground ">
                    Cooldown minutes
                  </div>
                  <Input
                    type="number"
                    value={cooldownMin}
                    onChange={(e) => setCooldownMin(e.target.value)}
                    placeholder="60"
                  />
                  <div className="text-[10px] text-muted-foreground">
                    Prevents repeated alerts for the same rule.
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <TLButton onClick={create} disabled={creating}>
                  {creating ? "Creating..." : "Create rule"}
                </TLButton>
              </div>

              <TLInlineAlert
                title="Recommendation"
                description="Start with one rule for tender changes and a cooldown of 120 minutes. Add keywords only when you trust signal quality."
                tone="neutral"
              />
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {items.length === 0 && !loading ? (
              <Card>
                <CardContent className="p-6 text-sm text-center text-muted-foreground">
                  No rules yet.
                </CardContent>
              </Card>
            ) : null}

            {items.map((r) => (
              <Card key={r.id} className="border-l-4 border-l-primary/40">
                <CardContent className="p-6 space-y-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-bold">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {r.tenderId
                          ? `Tender scoped: ${r.tenderId.slice(0, 8)}...`
                          : "Organization-wide rule"}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground ">
                          Enabled
                        </span>
                        <Switch
                          checked={r.isEnabled}
                          onCheckedChange={(v) => setEnabled(r, Boolean(v))}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(r)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-[10px] font-medium text-muted-foreground pt-3 border-t">
                    <div className="flex gap-1.5">
                      <span className="font-bold tracking-widest opacity-70">
                        Events:
                      </span>{" "}
                      <span className="text-foreground/80">
                        {r.eventTypes?.length
                          ? r.eventTypes
                              .join(", ")
                              .toLowerCase()
                              .replace(/_/g, " ")
                          : "All"}
                      </span>
                    </div>
                    <div className="flex gap-1.5 border-l pl-4">
                      <span className="font-bold tracking-widest opacity-70">
                        Cooldown:
                      </span>{" "}
                      <span className="text-foreground/80">
                        {r.cooldownMin} min
                      </span>
                    </div>
                  </div>

                  {r.keywords?.length ? (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] font-bold tracking-widest text-muted-foreground opacity-70">
                        Keywords:
                      </span>
                      {r.keywords.map((k) => (
                        <span
                          key={k}
                          className="px-2 py-0.5 bg-muted text-foreground rounded text-[10px] font-medium border"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {r.lastFiredAt ? (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Last fired: {new Date(r.lastFiredAt).toLocaleString()}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </TLSection>
    </div>
  );
}
