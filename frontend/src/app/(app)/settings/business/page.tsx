"use client";

import * as React from "react";
import { toast } from "sonner";
import { TenderLensAppShell } from "@/components/tenderlens/app-shell";
import { TLSection } from "@/components/tenderlens/section";
import { TLButton } from "@/components/tenderlens/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBilling } from "@/hooks/use-billing";
import {
  applyWorkspaceTemplate,
  createIntegration,
  createSupportTicket,
  createWorkspaceTemplate,
  deleteIntegration,
  deleteWorkspaceTemplate,
  getAccountManager,
  getBusinessAnalytics,
  getBusinessProfile,
  getOnboardingAssistance,
  listIntegrations,
  listSupportTickets,
  listWorkspaceTemplates,
  requestOnboardingAssistance,
  updateBusinessCustomLimits,
  updateBusinessProfile,
  updateIntegration,
  updateSupportTicket,
  updateWorkspaceTemplate,
} from "@/lib/business.api";
import type {
  BusinessAnalytics,
  BusinessCustomLimits,
  BusinessProfile,
  IntegrationEndpoint,
  SupportTicket,
  WorkspaceTemplate,
} from "@/lib/business.types";
import { formatDateTime } from "@/lib/date-utils";

type TemplateDraft = {
  name: string;
  description: string;
  isDefault: boolean;
  applyTenderId: string;
};

type TicketDraft = {
  status: SupportTicket["status"];
  resolutionNotes: string;
};

type IntegrationDraft = {
  name: string;
  endpointUrl: string;
  authType: "none" | "bearer";
  authToken: string;
  subscribedEventsText: string;
  isEnabled: boolean;
};

const BOOLEAN_LIMIT_FIELDS = [
  { key: "exportsEnabled", label: "PDF/XLSX exports" },
  { key: "workspaceEnabled", label: "Workspace & tasks" },
  { key: "compareEnabled", label: "Tender compare" },
  { key: "whatsappEnabled", label: "SMS alerts" },
  { key: "riskEnabled", label: "Risk scoring" },
] as const;

type BooleanLimitKey = (typeof BOOLEAN_LIMIT_FIELDS)[number]["key"];

function toNum(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function boolToChoice(v: boolean | null | undefined) {
  if (v === true) return "enabled";
  if (v === false) return "disabled";
  return "default";
}

function choiceToBool(v: string): boolean | null {
  if (v === "enabled") return true;
  if (v === "disabled") return false;
  return null;
}

function normalizeChannels(input: string[]) {
  const allowed = new Set(["email", "whatsapp"]);
  return Array.from(
    new Set(
      input
        .map((v) => v.trim().toLowerCase())
        .filter((v) => allowed.has(v)),
    ),
  ) as Array<"email" | "whatsapp">;
}

function parseCsv(input: string) {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  );
}

export default function BusinessSettingsPage() {
  const { subscription } = useBilling();
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<BusinessProfile | null>(null);
  const [limits, setLimits] = React.useState<BusinessCustomLimits | null>(null);
  const [analytics, setAnalytics] = React.useState<BusinessAnalytics | null>(
    null,
  );
  const [templates, setTemplates] = React.useState<WorkspaceTemplate[]>([]);
  const [templateDrafts, setTemplateDrafts] = React.useState<
    Record<string, TemplateDraft>
  >({});
  const [integrations, setIntegrations] = React.useState<IntegrationEndpoint[]>(
    [],
  );
  const [integrationDrafts, setIntegrationDrafts] = React.useState<
    Record<string, IntegrationDraft>
  >({});
  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const [ticketDrafts, setTicketDrafts] = React.useState<
    Record<string, TicketDraft>
  >({});
  const [onboarding, setOnboarding] = React.useState<{
    status: string;
    requestedAt: string | null;
    notes: string | null;
  } | null>(null);
  const [accountManager, setAccountManagerState] = React.useState<{
    name: string | null;
    email: string | null;
    notes: string | null;
    supportSlaHours: number;
  } | null>(null);

  const [templateName, setTemplateName] = React.useState("");
  const [templateTaskTitle, setTemplateTaskTitle] = React.useState("");
  const [integrationName, setIntegrationName] = React.useState("");
  const [integrationUrl, setIntegrationUrl] = React.useState("");
  const [integrationAuthType, setIntegrationAuthType] = React.useState<
    "none" | "bearer"
  >("none");
  const [integrationAuthToken, setIntegrationAuthToken] = React.useState("");
  const [integrationEvents, setIntegrationEvents] = React.useState("");
  const [ticketSubject, setTicketSubject] = React.useState("");
  const [ticketDescription, setTicketDescription] = React.useState("");

  const syncTemplateDrafts = React.useCallback((items: WorkspaceTemplate[]) => {
    setTemplateDrafts((prev) => {
      const next: Record<string, TemplateDraft> = {};
      for (const item of items) {
        next[item.id] = {
          name: item.name,
          description: item.description ?? "",
          isDefault: item.isDefault,
          applyTenderId: prev[item.id]?.applyTenderId ?? "",
        };
      }
      return next;
    });
  }, []);

  const syncTicketDrafts = React.useCallback((items: SupportTicket[]) => {
    setTicketDrafts((prev) => {
      const next: Record<string, TicketDraft> = {};
      for (const item of items) {
        next[item.id] = {
          status: item.status,
          resolutionNotes:
            prev[item.id]?.resolutionNotes ?? item.resolutionNotes ?? "",
        };
      }
      return next;
    });
  }, []);

  const syncIntegrationDrafts = React.useCallback(
    (items: IntegrationEndpoint[]) => {
      setIntegrationDrafts(() => {
        const next: Record<string, IntegrationDraft> = {};
        for (const item of items) {
          next[item.id] = {
            name: item.name,
            endpointUrl: item.endpointUrl,
            authType: item.authType ?? "none",
            authToken: "",
            subscribedEventsText: (item.subscribedEvents ?? []).join(", "),
            isEnabled: item.isEnabled,
          };
        }
        return next;
      });
    },
    [],
  );

  async function load() {
    setLoading(true);
    const [p, a, t, i, s, o, m] = await Promise.all([
      getBusinessProfile(),
      getBusinessAnalytics(),
      listWorkspaceTemplates(),
      listIntegrations(),
      listSupportTickets(),
      getOnboardingAssistance(),
      getAccountManager(),
    ]);
    setLoading(false);

    if (!p.ok) {
      toast.error("Failed to load BUSINESS settings", {
        description: p.error.message,
      });
      return;
    }

    setProfile(p.data.profile);
    setLimits(p.data.customLimits);
    if (a.ok) setAnalytics(a.data.analytics);
    if (t.ok) {
      setTemplates(t.data.items);
      syncTemplateDrafts(t.data.items);
    }
    if (i.ok) {
      setIntegrations(i.data.items);
      syncIntegrationDrafts(i.data.items);
    }
    if (s.ok) {
      setTickets(s.data.items);
      syncTicketDrafts(s.data.items);
    }
    if (o.ok) setOnboarding(o.data);
    if (m.ok) setAccountManagerState(m.data);
  }

  React.useEffect(() => {
    if (subscription?.plan === "BUSINESS") void load();
    else setLoading(false);
  }, [subscription?.plan]);

  if (subscription?.plan !== "BUSINESS") {
    return (
      <TenderLensAppShell title="TenderLens" subtitle="Business Settings">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            BUSINESS settings are only available on the BUSINESS plan.
          </CardContent>
        </Card>
      </TenderLensAppShell>
    );
  }

  return (
    <TenderLensAppShell
      title="TenderLens"
      subtitle="Business Settings"
      description="BUSINESS features: automation, governance, analytics, integrations, and support."
    >
      <TLSection title="Analytics">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Workspaces</div>
              <div className="text-xl font-semibold">
                {loading ? "-" : analytics?.workspaces ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Task Completion</div>
              <div className="text-xl font-semibold">
                {loading ? "-" : `${analytics?.tasks.completionRate ?? 0}%`}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Alerts (30d)</div>
              <div className="text-xl font-semibold">
                {loading ? "-" : analytics?.alertsFired30d ?? 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Avg Risk</div>
              <div className="text-xl font-semibold">
                {loading ? "-" : analytics?.avgRiskScore ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>
      </TLSection>

      <TLSection
        title="Automation & Governance"
        right={
          <TLButton
            onClick={async () => {
              if (!profile) return;
              const res = await updateBusinessProfile({
                alertAutomationEnabled: profile.alertAutomationEnabled,
                alertDefaultChannels: profile.alertDefaultChannels,
                alertEscalationEnabled: profile.alertEscalationEnabled,
                alertEscalationMinutes: profile.alertEscalationMinutes,
                alertEscalationChannels: profile.alertEscalationChannels,
                taskGovernanceEnabled: profile.taskGovernanceEnabled,
                requireTaskOwner: profile.requireTaskOwner,
                requireTaskDueDate: profile.requireTaskDueDate,
                blockTaskCloseWithoutAssignee:
                  profile.blockTaskCloseWithoutAssignee,
                blockTaskCloseWithoutDueDate: profile.blockTaskCloseWithoutDueDate,
              });
              if (!res.ok) {
                toast.error("Failed to save profile", {
                  description: res.error.message,
                });
                return;
              }
              setProfile(res.data);
              toast.success("BUSINESS profile updated");
            }}
          >
            Save
          </TLButton>
        }
      >
        {!profile ? null : (
          <Card>
            <CardContent className="grid gap-3 p-6">
              <label className="flex items-center justify-between">
                <span className="text-sm">Alert Automation</span>
                <Switch
                  checked={profile.alertAutomationEnabled}
                  onCheckedChange={(v) =>
                    setProfile((p) =>
                      p ? { ...p, alertAutomationEnabled: Boolean(v) } : p,
                    )
                  }
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm">Escalation</span>
                <Switch
                  checked={profile.alertEscalationEnabled}
                  onCheckedChange={(v) =>
                    setProfile((p) =>
                      p ? { ...p, alertEscalationEnabled: Boolean(v) } : p,
                    )
                  }
                />
              </label>
              <label className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  Escalation Minutes
                </div>
                <Input
                  type="number"
                  value={profile.alertEscalationMinutes}
                  onChange={(e) =>
                    setProfile((p) =>
                      p
                        ? {
                            ...p,
                            alertEscalationMinutes: Math.max(
                              1,
                              Number(e.target.value || 1),
                            ),
                          }
                        : p,
                    )
                  }
                />
              </label>
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">
                  Default Alert Channels
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.alertDefaultChannels.includes("email")}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              alertDefaultChannels: normalizeChannels(
                                e.target.checked
                                  ? [...p.alertDefaultChannels, "email"]
                                  : p.alertDefaultChannels.filter(
                                      (c) => c !== "email",
                                    ),
                              ),
                            }
                          : p,
                      )
                    }
                  />
                  Email
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.alertDefaultChannels.includes("whatsapp")}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              alertDefaultChannels: normalizeChannels(
                                e.target.checked
                                  ? [...p.alertDefaultChannels, "whatsapp"]
                                  : p.alertDefaultChannels.filter(
                                      (c) => c !== "whatsapp",
                                    ),
                              ),
                            }
                          : p,
                      )
                    }
                  />
                  SMS
                </label>
              </div>
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="text-xs text-muted-foreground">
                  Escalation Channels
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.alertEscalationChannels.includes("email")}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              alertEscalationChannels: normalizeChannels(
                                e.target.checked
                                  ? [...p.alertEscalationChannels, "email"]
                                  : p.alertEscalationChannels.filter(
                                      (c) => c !== "email",
                                    ),
                              ),
                            }
                          : p,
                      )
                    }
                  />
                  Email
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={profile.alertEscalationChannels.includes(
                      "whatsapp",
                    )}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              alertEscalationChannels: normalizeChannels(
                                e.target.checked
                                  ? [...p.alertEscalationChannels, "whatsapp"]
                                  : p.alertEscalationChannels.filter(
                                      (c) => c !== "whatsapp",
                                    ),
                              ),
                            }
                          : p,
                      )
                    }
                  />
                  SMS
                </label>
              </div>
              <label className="flex items-center justify-between">
                <span className="text-sm">Task Governance</span>
                <Switch
                  checked={profile.taskGovernanceEnabled}
                  onCheckedChange={(v) =>
                    setProfile((p) =>
                      p ? { ...p, taskGovernanceEnabled: Boolean(v) } : p,
                    )
                  }
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm">Require Owner</span>
                <Switch
                  checked={profile.requireTaskOwner}
                  onCheckedChange={(v) =>
                    setProfile((p) =>
                      p ? { ...p, requireTaskOwner: Boolean(v) } : p,
                    )
                  }
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm">Require Due Date</span>
                <Switch
                  checked={profile.requireTaskDueDate}
                  onCheckedChange={(v) =>
                    setProfile((p) =>
                      p ? { ...p, requireTaskDueDate: Boolean(v) } : p,
                    )
                  }
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm">Block Close Without Assignee</span>
                <Switch
                  checked={profile.blockTaskCloseWithoutAssignee}
                  onCheckedChange={(v) =>
                    setProfile((p) =>
                      p
                        ? {
                            ...p,
                            blockTaskCloseWithoutAssignee: Boolean(v),
                          }
                        : p,
                    )
                  }
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm">Block Close Without Due Date</span>
                <Switch
                  checked={profile.blockTaskCloseWithoutDueDate}
                  onCheckedChange={(v) =>
                    setProfile((p) =>
                      p
                        ? {
                            ...p,
                            blockTaskCloseWithoutDueDate: Boolean(v),
                          }
                        : p,
                    )
                  }
                />
              </label>
              <div className="text-xs text-muted-foreground">
                Support SLA is managed by your system administrator.
              </div>
            </CardContent>
          </Card>
        )}
      </TLSection>

      <TLSection
        title="Custom Limits"
        right={
          <TLButton
            onClick={async () => {
              if (!limits) return;
              const res = await updateBusinessCustomLimits(limits);
              if (!res.ok) {
                toast.error("Failed to save limits", {
                  description: res.error.message,
                });
                return;
              }
              setLimits(res.data);
              toast.success("Custom limits updated");
              window.dispatchEvent(new Event("tl:usage-refresh"));
            }}
          >
            Save Limits
          </TLButton>
        }
      >
        {!limits ? null : (
          <Card>
            <CardContent className="grid grid-cols-1 gap-3 p-6 md:grid-cols-3">
              <Input
                type="number"
                placeholder="Max AI queries"
                value={limits.maxAiQueries ?? ""}
                onChange={(e) =>
                  setLimits((v) =>
                    v ? { ...v, maxAiQueries: toNum(e.target.value) } : v,
                  )
                }
              />
              <Input
                type="number"
                placeholder="Max watchlist"
                value={limits.maxWatchlist ?? ""}
                onChange={(e) =>
                  setLimits((v) =>
                    v ? { ...v, maxWatchlist: toNum(e.target.value) } : v,
                  )
                }
              />
              <Input
                type="number"
                placeholder="Max members"
                value={limits.maxMembers ?? ""}
                onChange={(e) =>
                  setLimits((v) =>
                    v ? { ...v, maxMembers: toNum(e.target.value) } : v,
                  )
                }
              />
              {BOOLEAN_LIMIT_FIELDS.map((field) => (
                <label key={field.key} className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {field.label}
                  </div>
                  <select
                    value={boolToChoice(limits[field.key])}
                    onChange={(e) =>
                      setLimits((v) => {
                        if (!v) return v;
                        const key = field.key as BooleanLimitKey;
                        return {
                          ...v,
                          [key]: choiceToBool(e.target.value),
                        } as BusinessCustomLimits;
                      })
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="default">Use plan default</option>
                    <option value="enabled">Force enabled</option>
                    <option value="disabled">Force disabled</option>
                  </select>
                </label>
              ))}
            </CardContent>
          </Card>
        )}
      </TLSection>

      <TLSection title="Workspace Categories">
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 p-6 md:grid-cols-3">
            <Input
              placeholder="Category name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <Input
              placeholder="First task title"
              value={templateTaskTitle}
              onChange={(e) => setTemplateTaskTitle(e.target.value)}
            />
            <TLButton
              onClick={async () => {
                const name = templateName.trim();
                const firstTask = templateTaskTitle.trim();
                if (!name || !firstTask) {
                  toast.error("Category name and task title are required");
                  return;
                }
                const res = await createWorkspaceTemplate({
                  name,
                  tasks: [{ title: firstTask }],
                });
                if (!res.ok) {
                  toast.error("Failed to create category", {
                    description: res.error.message,
                  });
                  return;
                }
                setTemplateName("");
                setTemplateTaskTitle("");
                await load();
              }}
            >
              Create
            </TLButton>
          </CardContent>
        </Card>
        {templates.map((template) => {
          const draft = templateDrafts[template.id] ?? {
            name: template.name,
            description: template.description ?? "",
            isDefault: template.isDefault,
            applyTenderId: "",
          };

          return (
            <Card key={template.id}>
              <CardContent className="grid gap-3 p-4">
                <div className="text-sm font-medium">
                  {template.name} - {template.tasks.length} tasks
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Input
                    placeholder="Category name"
                    value={draft.name}
                    onChange={(e) =>
                      setTemplateDrafts((prev) => ({
                        ...prev,
                        [template.id]: {
                          ...draft,
                          name: e.target.value,
                        },
                      }))
                    }
                  />
                  <Input
                    placeholder="Category description"
                    value={draft.description}
                    onChange={(e) =>
                      setTemplateDrafts((prev) => ({
                        ...prev,
                        [template.id]: {
                          ...draft,
                          description: e.target.value,
                        },
                      }))
                    }
                  />
                  <label className="flex items-center justify-between rounded-md border border-input px-3">
                    <span className="text-sm">Default category</span>
                    <Switch
                      checked={draft.isDefault}
                      onCheckedChange={(v) =>
                        setTemplateDrafts((prev) => ({
                          ...prev,
                          [template.id]: {
                            ...draft,
                            isDefault: Boolean(v),
                          },
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
                  <Input
                    placeholder="Tender ID to apply this category"
                    value={draft.applyTenderId}
                    onChange={(e) =>
                      setTemplateDrafts((prev) => ({
                        ...prev,
                        [template.id]: {
                          ...draft,
                          applyTenderId: e.target.value,
                        },
                      }))
                    }
                  />
                  <TLButton
                    variant="secondary"
                    onClick={async () => {
                      const name = draft.name.trim();
                      if (!name) {
                        toast.error("Category name is required");
                        return;
                      }
                      const res = await updateWorkspaceTemplate(template.id, {
                        name,
                        description: draft.description.trim() || null,
                        isDefault: draft.isDefault,
                      });
                      if (!res.ok) {
                        toast.error("Failed to update category", {
                          description: res.error.message,
                        });
                        return;
                      }
                      await load();
                    }}
                  >
                    Save Category
                  </TLButton>
                  <TLButton
                    onClick={async () => {
                      const tenderId = draft.applyTenderId.trim();
                      if (!tenderId) {
                        toast.error("Tender ID is required");
                        return;
                      }
                      const res = await applyWorkspaceTemplate(
                        template.id,
                        tenderId,
                      );
                      if (!res.ok) {
                        toast.error("Failed to apply category", {
                          description: res.error.message,
                        });
                        return;
                      }
                      toast.success(`Created ${res.data.created} tasks`);
                      setTemplateDrafts((prev) => ({
                        ...prev,
                        [template.id]: {
                          ...draft,
                          applyTenderId: "",
                        },
                      }));
                    }}
                  >
                    Apply Category
                  </TLButton>
                </div>
                <TLButton
                  variant="secondary"
                  onClick={async () => {
                    const res = await deleteWorkspaceTemplate(template.id);
                    if (!res.ok) {
                      toast.error("Failed to archive category", {
                        description: res.error.message,
                      });
                      return;
                    }
                    await load();
                  }}
                >
                  Archive
                </TLButton>
              </CardContent>
            </Card>
          );
        })}
      </TLSection>

      <TLSection title="Integrations">
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 p-6 md:grid-cols-2">
            <Input
              placeholder="Name"
              value={integrationName}
              onChange={(e) => setIntegrationName(e.target.value)}
            />
            <Input
              placeholder="Webhook URL"
              value={integrationUrl}
              onChange={(e) => setIntegrationUrl(e.target.value)}
            />
            <select
              value={integrationAuthType}
              onChange={(e) =>
                setIntegrationAuthType(e.target.value as "none" | "bearer")
              }
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="none">No authentication</option>
              <option value="bearer">Bearer token</option>
            </select>
            <Input
              placeholder="Bearer token (optional)"
              type="password"
              value={integrationAuthToken}
              onChange={(e) => setIntegrationAuthToken(e.target.value)}
            />
            <Input
              placeholder="Subscribed events (comma separated, optional)"
              value={integrationEvents}
              onChange={(e) => setIntegrationEvents(e.target.value)}
            />
            <TLButton
              onClick={async () => {
                const name = integrationName.trim();
                const endpointUrl = integrationUrl.trim();
                if (!name || !endpointUrl) {
                  toast.error("Name and URL are required");
                  return;
                }
                const authToken =
                  integrationAuthType === "bearer"
                    ? integrationAuthToken.trim() || null
                    : null;
                const subscribedEvents = parseCsv(integrationEvents);
                const res = await createIntegration({
                  name,
                  endpointUrl,
                  authType: integrationAuthType,
                  authToken,
                  subscribedEvents,
                });
                if (!res.ok) {
                  toast.error("Failed to create integration", {
                    description: res.error.message,
                  });
                  return;
                }
                setIntegrationName("");
                setIntegrationUrl("");
                setIntegrationAuthType("none");
                setIntegrationAuthToken("");
                setIntegrationEvents("");
                await load();
              }}
            >
              Add
            </TLButton>
          </CardContent>
        </Card>
        {integrations.map((integration) => {
          const draft = integrationDrafts[integration.id] ?? {
            name: integration.name,
            endpointUrl: integration.endpointUrl,
            authType: integration.authType ?? "none",
            authToken: "",
            subscribedEventsText: (integration.subscribedEvents ?? []).join(
              ", ",
            ),
            isEnabled: integration.isEnabled,
          };

          return (
            <Card key={integration.id}>
              <CardContent className="grid gap-3 p-4">
                <div className="text-xs text-muted-foreground">
                  Last delivered:{" "}
                  {integration.lastDeliveredAt
                    ? formatDateTime(integration.lastDeliveredAt)
                    : "Never"}
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input
                    placeholder="Name"
                    value={draft.name}
                    onChange={(e) =>
                      setIntegrationDrafts((prev) => ({
                        ...prev,
                        [integration.id]: {
                          ...draft,
                          name: e.target.value,
                        },
                      }))
                    }
                  />
                  <Input
                    placeholder="Webhook URL"
                    value={draft.endpointUrl}
                    onChange={(e) =>
                      setIntegrationDrafts((prev) => ({
                        ...prev,
                        [integration.id]: {
                          ...draft,
                          endpointUrl: e.target.value,
                        },
                      }))
                    }
                  />
                  <select
                    value={draft.authType}
                    onChange={(e) =>
                      setIntegrationDrafts((prev) => ({
                        ...prev,
                        [integration.id]: {
                          ...draft,
                          authType: e.target.value as "none" | "bearer",
                        },
                      }))
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="none">No authentication</option>
                    <option value="bearer">Bearer token</option>
                  </select>
                  <Input
                    placeholder={
                      integration.hasAuthToken
                        ? "Bearer token (leave blank to keep existing)"
                        : "Bearer token (optional)"
                    }
                    type="password"
                    value={draft.authToken}
                    onChange={(e) =>
                      setIntegrationDrafts((prev) => ({
                        ...prev,
                        [integration.id]: {
                          ...draft,
                          authToken: e.target.value,
                        },
                      }))
                    }
                  />
                  <Input
                    className="md:col-span-2"
                    placeholder="Subscribed events (comma separated)"
                    value={draft.subscribedEventsText}
                    onChange={(e) =>
                      setIntegrationDrafts((prev) => ({
                        ...prev,
                        [integration.id]: {
                          ...draft,
                          subscribedEventsText: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <TLButton
                    variant="secondary"
                    onClick={async () => {
                      const name = draft.name.trim();
                      const endpointUrl = draft.endpointUrl.trim();
                      if (!name || !endpointUrl) {
                        toast.error("Name and URL are required");
                        return;
                      }
                      const authTokenTrimmed = draft.authToken.trim();
                      const res = await updateIntegration(integration.id, {
                        name,
                        endpointUrl,
                        authType: draft.authType,
                        authToken:
                          draft.authType === "bearer"
                            ? authTokenTrimmed
                              ? authTokenTrimmed
                              : null
                            : null,
                        isEnabled: draft.isEnabled,
                        subscribedEvents: parseCsv(draft.subscribedEventsText),
                      });
                      if (!res.ok) {
                        toast.error("Failed to update integration", {
                          description: res.error.message,
                        });
                        return;
                      }
                      await load();
                    }}
                  >
                    Save
                  </TLButton>
                  <TLButton
                    variant="secondary"
                    onClick={async () => {
                      const res = await updateIntegration(integration.id, {
                        isEnabled: !draft.isEnabled,
                      });
                      if (!res.ok) {
                        toast.error("Failed to update integration", {
                          description: res.error.message,
                        });
                        return;
                      }
                      await load();
                    }}
                  >
                    {draft.isEnabled ? "Disable" : "Enable"}
                  </TLButton>
                  <TLButton
                    variant="secondary"
                    onClick={async () => {
                      const res = await deleteIntegration(integration.id);
                      if (!res.ok) {
                        toast.error("Failed to delete integration", {
                          description: res.error.message,
                        });
                        return;
                      }
                      await load();
                    }}
                  >
                    Delete
                  </TLButton>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </TLSection>

      <TLSection title="Onboarding & Account Manager">
        <Card>
          <CardContent className="grid gap-3 p-6">
            <div className="text-sm">
              Onboarding: <strong>{onboarding?.status ?? "NOT_REQUESTED"}</strong>
            </div>
            <Textarea
              placeholder="Onboarding notes"
              value={onboarding?.notes ?? ""}
              onChange={(e) =>
                setOnboarding((o) => (o ? { ...o, notes: e.target.value } : o))
              }
            />
            <TLButton
              onClick={async () => {
                const res = await requestOnboardingAssistance(
                  onboarding?.notes ?? undefined,
                );
                if (!res.ok) {
                  toast.error("Failed to request onboarding", {
                    description: res.error.message,
                  });
                  return;
                }
                setOnboarding(res.data);
              }}
            >
              Request Onboarding Assistance
            </TLButton>
            <div className="rounded-md border border-border p-3 text-sm">
              <div className="font-medium">Dedicated Account Manager</div>
              <div className="text-muted-foreground">
                Assigned by system administrator only.
              </div>
              <div className="mt-2">
                Name: <strong>{accountManager?.name || "-"}</strong>
              </div>
              <div>
                Email: <strong>{accountManager?.email || "-"}</strong>
              </div>
              <div>
                SLA: <strong>{accountManager?.supportSlaHours ?? 4} hours</strong>
              </div>
              <div>
                Notes: <strong>{accountManager?.notes || "-"}</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      </TLSection>

      <TLSection title="Priority Support">
        <Card>
          <CardContent className="grid gap-3 p-6">
            <Input
              placeholder="Support subject"
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
            />
            <Textarea
              placeholder="Describe your request"
              value={ticketDescription}
              onChange={(e) => setTicketDescription(e.target.value)}
            />
            <TLButton
              onClick={async () => {
                const subject = ticketSubject.trim();
                const description = ticketDescription.trim();
                if (!subject || !description) {
                  toast.error("Subject and description are required");
                  return;
                }
                const res = await createSupportTicket({ subject, description });
                if (!res.ok) {
                  toast.error("Failed to create support ticket", {
                    description: res.error.message,
                  });
                  return;
                }
                setTicketSubject("");
                setTicketDescription("");
                await load();
              }}
            >
              Create Ticket
            </TLButton>
          </CardContent>
        </Card>
        {tickets.map((ticket) => {
          const draft = ticketDrafts[ticket.id] ?? {
            status: ticket.status,
            resolutionNotes: ticket.resolutionNotes ?? "",
          };
          return (
            <Card key={ticket.id}>
              <CardContent className="grid gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {ticket.subject} - {ticket.status}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Priority: {ticket.priority}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Created: {formatDateTime(ticket.createdAt)} | SLA due: {formatDateTime(ticket.slaDueAt)} | Remaining: {ticket.slaRemainingMinutes} min | Breached: {ticket.slaBreached ? "Yes" : "No"}
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[220px_1fr_auto]">
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setTicketDrafts((prev) => ({
                        ...prev,
                        [ticket.id]: {
                          ...draft,
                          status: e.target.value as SupportTicket["status"],
                        },
                      }))
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                  <Input
                    placeholder="Resolution notes (required for resolved/closed)"
                    value={draft.resolutionNotes}
                    onChange={(e) =>
                      setTicketDrafts((prev) => ({
                        ...prev,
                        [ticket.id]: {
                          ...draft,
                          resolutionNotes: e.target.value,
                        },
                      }))
                    }
                  />
                  <TLButton
                    variant="secondary"
                    onClick={async () => {
                      const notes = draft.resolutionNotes.trim();
                      const res = await updateSupportTicket(ticket.id, {
                        status: draft.status,
                        resolutionNotes: notes ? notes : null,
                      });
                      if (!res.ok) {
                        toast.error("Failed to update support ticket", {
                          description: res.error.message,
                        });
                        return;
                      }
                      await load();
                    }}
                  >
                    Update Ticket
                  </TLButton>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </TLSection>
    </TenderLensAppShell>
  );
}
