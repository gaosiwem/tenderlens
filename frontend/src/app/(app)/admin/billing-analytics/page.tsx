"use client";

import * as React from "react";
import { toast } from "sonner";
import { Activity, RefreshCw, Users, Wallet, Clock3, MousePointerClick } from "lucide-react";
import { TLSection } from "@/components/tenderlens/section";
import { TLCodeBadge } from "@/components/tenderlens/code-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AdvancedAnalyticsActivity,
  AdvancedAnalyticsEvent,
  AdvancedAnalyticsSummary,
  AdvancedAnalyticsUser,
  getAdvancedAnalytics,
} from "@/lib/billing-analytics.api";
import { formatDate, formatDateTime } from "@/lib/date-utils";

function LifecycleBadge({ value }: { value: AdvancedAnalyticsUser["lifecycle"] }) {
  const className =
    value === "PAID"
      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
      : value === "TRIALING"
        ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
        : value === "TRIAL_EXPIRED"
          ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
          : value === "PAST_DUE"
            ? "bg-red-500/10 text-red-600 border-red-500/20"
            : "bg-muted text-muted-foreground border-border";

  return <TLCodeBadge value={value.replaceAll("_", " ")} className={className} />;
}

function MetricCard(props: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "good" | "warn";
}) {
  const toneClass =
    props.tone === "good"
      ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
      : props.tone === "warn"
        ? "text-amber-700 bg-amber-500/10 border-amber-500/20"
        : "text-primary bg-primary/10 border-primary/20";

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {props.title}
          </div>
          <div className="mt-3 text-3xl font-black">{props.value}</div>
        </div>
        <div className={`rounded-2xl border p-3 ${toneClass}`}>
          <props.icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function summarizeMeta(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "-";
  const entries = Object.entries(meta as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return entries.length ? entries.join(" | ") : "-";
}

export default function BillingAnalyticsPage() {
  const [loading, setLoading] = React.useState(true);
  const [days, setDays] = React.useState(30);
  const [search, setSearch] = React.useState("");
  const [lifecycle, setLifecycle] = React.useState("ALL");
  const [summary, setSummary] = React.useState<AdvancedAnalyticsSummary | null>(
    null,
  );
  const [eventSummary, setEventSummary] = React.useState<AdvancedAnalyticsEvent[]>(
    [],
  );
  const [users, setUsers] = React.useState<AdvancedAnalyticsUser[]>([]);
  const [recentActivity, setRecentActivity] = React.useState<
    AdvancedAnalyticsActivity[]
  >([]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    const res = await getAdvancedAnalytics(days);
    setLoading(false);

    if (!res.ok) {
      toast.error("Advanced analytics unavailable", {
        description: res.error.message,
      });
      return;
    }

    setSummary(res.data.summary);
    setEventSummary(res.data.eventSummary);
    setUsers(res.data.users);
    setRecentActivity(res.data.recentActivity);
  }, [days]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredUsers = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !needle ||
        user.fullName.toLowerCase().includes(needle) ||
        user.email?.toLowerCase().includes(needle) ||
        user.phone?.toLowerCase().includes(needle) ||
        user.subscriptions.some(
          (sub) =>
            sub.orgName.toLowerCase().includes(needle) ||
            sub.orgSlug.toLowerCase().includes(needle),
        );

      const matchesLifecycle =
        lifecycle === "ALL" ? true : user.lifecycle === lifecycle;

      return matchesSearch && matchesLifecycle;
    });
  }, [lifecycle, search, users]);

  return (
    <div className="space-y-6">
      <TLSection
        title="Advanced Analytics"
        description="See how many users are paid, trialing, expired, actively using the platform, and which tracked product actions they are taking."
        right={
          <div className="flex items-center gap-3">
            <select
              className="h-10 rounded-lg border bg-background px-3 text-sm font-semibold"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>Last 7 Days</option>
              <option value={14}>Last 14 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
          </div>
        }
      >
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Tracked activity currently reflects instrumented pricing, paywall,
            checkout, and plan-limit events. It is useful for adoption and
            conversion monitoring, but it is not yet a full clickstream of every
            screen interaction.
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="Registered Users"
            value={summary?.totalUsers ?? 0}
            icon={Users}
          />
          <MetricCard
            title="Active In Window"
            value={summary?.activeUsers ?? 0}
            icon={Activity}
          />
          <MetricCard
            title="Paid Users"
            value={summary?.paidUsers ?? 0}
            icon={Wallet}
            tone="good"
          />
          <MetricCard
            title="Trialing Users"
            value={summary?.trialingUsers ?? 0}
            icon={Clock3}
          />
          <MetricCard
            title="Trial Expired"
            value={summary?.trialExpiredUsers ?? 0}
            icon={Clock3}
            tone="warn"
          />
          <MetricCard
            title="Tracked Events"
            value={summary?.totalTrackedEvents ?? 0}
            icon={MousePointerClick}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <div className="text-base font-extrabold">Top tracked actions</div>
                <div className="text-sm text-muted-foreground">
                  What users are clicking in the currently instrumented billing
                  and paywall flows.
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Count</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventSummary.slice(0, 12).map((item) => (
                    <TableRow key={item.name}>
                      <TableCell className="font-semibold">{item.name}</TableCell>
                      <TableCell>{item.count}</TableCell>
                      <TableCell>{item.uniqueUsers}</TableCell>
                      <TableCell>{formatDateTime(item.lastSeenAt)}</TableCell>
                    </TableRow>
                  ))}
                  {!eventSummary.length ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">
                        No tracked activity found in this window.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <div className="text-base font-extrabold">Recent tracked activity</div>
                <div className="text-sm text-muted-foreground">
                  Latest instrumented product actions with contact detail when available.
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity.slice(0, 12).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-semibold">{item.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {summarizeMeta(item.meta)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{item.email ?? "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.phone ?? "No phone"}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{item.name}</TableCell>
                      <TableCell>
                        <div>{item.orgName}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.orgSlug}
                        </div>
                      </TableCell>
                      <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                  {!recentActivity.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        No recent tracked activity found.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-base font-extrabold">User roster</div>
                <div className="text-sm text-muted-foreground">
                  Full names, emails, phone numbers when available, subscription
                  state, and tracked click behavior.
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, phone, org"
                  className="sm:w-72"
                />
                <select
                  value={lifecycle}
                  onChange={(e) => setLifecycle(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="ALL">All lifecycles</option>
                  <option value="PAID">Paid</option>
                  <option value="TRIALING">Trialing</option>
                  <option value="TRIAL_EXPIRED">Trial expired</option>
                  <option value="PAST_DUE">Past due</option>
                  <option value="CANCELED">Canceled</option>
                  <option value="NO_SUBSCRIPTION">No subscription</option>
                </select>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Organizations</TableHead>
                  <TableHead>Tracked Clicks</TableHead>
                  <TableHead>Last Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div className="font-semibold">{user.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        Joined {formatDate(user.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{user.email ?? "-"}</div>
                      <div className="text-xs text-muted-foreground">
                        {user.phone ?? "No phone available"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <LifecycleBadge value={user.lifecycle} />
                    </TableCell>
                    <TableCell className="max-w-[320px] whitespace-normal">
                      <div className="space-y-2">
                        {user.subscriptions.length ? (
                          user.subscriptions.slice(0, 3).map((sub) => (
                            <div key={sub.orgId}>
                              <div className="font-semibold">{sub.orgName}</div>
                              <div className="text-xs text-muted-foreground">
                                {sub.orgSlug} | {sub.plan ?? "-"} | {sub.status ?? "-"}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No current organization subscription data
                          </div>
                        )}
                        {user.subscriptions.length > 3 ? (
                          <div className="text-xs text-muted-foreground">
                            +{user.subscriptions.length - 3} more
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[320px] whitespace-normal">
                      <div className="font-semibold">{user.trackedEventCount}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {user.topClicks.length
                          ? user.topClicks
                              .map((item) => `${item.name} (${item.count})`)
                              .join(", ")
                          : "No tracked clicks in this window"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.lastActivityAt
                        ? formatDateTime(user.lastActivityAt)
                        : "No tracked activity"}
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredUsers.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No users matched the current filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TLSection>
    </div>
  );
}
