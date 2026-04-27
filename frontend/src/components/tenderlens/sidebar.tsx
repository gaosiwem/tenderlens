"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Eye,
  Search,
  CreditCard,
  MessagesSquare,
  Shield,
  Bell,
  AlertCircle,
  ArrowLeftRight,
  Sparkles,
  Handshake,
  BarChart3,
  KanbanSquare,
  ChevronDown,
  BriefcaseBusiness,
  Terminal,
  Zap,
  Activity,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useUsage } from "@/hooks/use-usage";
import { useBilling } from "@/hooks/use-billing";
import { formatPlanBadgeLabel } from "@/lib/billing.types";
import { TLCodeBadge } from "./code-badge";
import { isSystemAdmin, useAuth } from "@/lib/auth";
import { BrandLogo } from "./brand-logo";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspace", label: "Workspaces", icon: KanbanSquare },
  { href: "/tenders?lifecycle=open", label: "Open Tenders", icon: FileText },
  { href: "/watchlist", label: "Watchlist", icon: Eye },
  { href: "/watchlist/templates", label: "Categories", icon: FileText },
  { href: "/awarded", label: "Awarded", icon: Shield },
  { href: "/closed", label: "Closed", icon: AlertCircle },
  { href: "/cancelled", label: "Cancelled", icon: AlertCircle },
  { href: "/compare", label: "Compare", icon: ArrowLeftRight },
  { href: "/chat", label: "Chat Hub", icon: MessagesSquare },
];

const settingsItems = [
  {
    href: "/settings/org-docs",
    label: "Business Docs",
    icon: BriefcaseBusiness,
  },
  { href: "/settings/members", label: "Members", icon: Users },
  { href: "/settings/business", label: "Business", icon: Building2 },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/pricing", label: "Plans & Pricing", icon: Sparkles },
];

const adminItems = [
  { href: "/admin", label: "Command Center", icon: Terminal },
  { href: "/workspace", label: "Workspaces", icon: KanbanSquare },
  { href: "/tenders?lifecycle=open", label: "Open Tenders", icon: FileText },
  { href: "/awarded", label: "Awarded", icon: Shield },
  { href: "/closed", label: "Closed", icon: AlertCircle },
  { href: "/cancelled", label: "Cancelled", icon: AlertCircle },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/revenue", label: "Revenue", icon: BarChart3 },
  { href: "/admin/scraper", label: "Scraper", icon: Zap },
  { href: "/admin/billing-analytics", label: "Analytics", icon: Activity },
  { href: "/admin/business", label: "Business Success", icon: Building2 },
  { href: "/admin/alerts", label: "Alert Rules", icon: AlertCircle },
  { href: "/admin/referrals", label: "Referrals", icon: Handshake },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

type SidebarItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  beta?: boolean;
};

function formatTrialEndDate(value?: string) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function TenderLensSidebar() {
  const path = usePathname();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { usage } = useUsage();
  const { subscription } = useBilling();
  const trialEndDate = formatTrialEndDate(subscription?.trialEndsAt);

  function isLifecycleItemAllowed(href: string) {
    const access = usage?.limits.tenderLifecycleAccess;
    if (!access || access.length === 0) return true;
    if (href === "/tenders?lifecycle=open") return access.includes("open");
    if (href === "/awarded") return access.includes("awarded");
    if (href === "/closed") return access.includes("closed");
    if (href === "/cancelled") return access.includes("cancelled");
    return true;
  }

  function NavLink({ it }: { it: SidebarItem }) {
    const [targetPath, targetQuery = ""] = it.href.split("?");
    const active =
      path === targetPath &&
      (targetQuery
        ? Array.from(new URLSearchParams(targetQuery).entries()).every(
            ([key, value]) => {
              const current = searchParams.get(key);
              if (key === "lifecycle" && value === "open" && !current) {
                return true;
              }
              return current === value;
            },
          )
        : true);
    const Icon = it.icon;
    return (
      <Link
        href={it.href}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
          "hover:bg-accent hover:text-accent-foreground",
          active && "bg-primary/15 text-primary ring-1 ring-primary/25",
        )}
      >
        <Icon className="size-4" />
        <span className="truncate">{it.label}</span>
        {it.badge ? (
          <span className="ml-auto text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {it.badge}
          </span>
        ) : null}
        {it.beta && (
          <span className="ml-auto text-[8px] font-black tracking-tighter bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm border border-primary/20">
            Beta
          </span>
        )}
      </Link>
    );
  }

  function NavGroup({
    title,
    children,
    defaultOpen = true,
  }: {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
  }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
      <div className="mt-4 first:mt-0">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full items-center justify-between px-2 py-2 text-[10px] font-bold tracking-widest text-muted-foreground hover:text-foreground transition-colors group"
        >
          {title}
          <ChevronDown
            className={cn(
              "size-3 transition-transform duration-200",
              !isOpen && "-rotate-90",
              "group-hover:text-foreground",
            )}
          />
        </button>
        {isOpen && <div className="mt-1 space-y-1">{children}</div>}
      </div>
    );
  }

  const isAdmin = isSystemAdmin(auth.me);

  return (
    <aside className="tl-surface p-4 h-full flex flex-col overflow-y-auto">
      <div className="mb-6 px-2">
        <div className="flex flex-col items-center gap-2">
          <BrandLogo priority size="sidebar" className="min-w-0" />
          {(subscription?.plan || isAdmin) ? (
            <TLCodeBadge
              value={formatPlanBadgeLabel({
                plan: subscription?.plan,
                status: subscription?.status,
                isAdmin,
              })}
              className="bg-primary/10 text-primary border-primary/20 scale-90"
            />
          ) : null}
        </div>
      </div>

      <div className="flex-1 space-y-2">
        {!isAdmin && (
          <>
            <NavGroup title="Main Menu">
              {mainNavItems
                .filter((it) => isLifecycleItemAllowed(it.href))
                .map((it) => {
                  const extra: SidebarItem = { ...it };
                  if (it.href === "/watchlist" && usage?.watchlistCount) {
                    extra.badge = usage.watchlistCount;
                  }
                  return <NavLink key={it.href} it={extra} />;
                })}
            </NavGroup>

            <NavGroup title="Settings & Billing">
              {settingsItems
                .filter(
                  (it) =>
                    it.href !== "/settings/business" ||
                    subscription?.plan === "BUSINESS",
                )
                .map((it) => (
                  <NavLink key={it.href} it={it} />
                ))}
            </NavGroup>
          </>
        )}

        {isAdmin && (
          <NavGroup title="Admin">
            {adminItems
              .filter((it) => isLifecycleItemAllowed(it.href))
              .map((it) => (
                <NavLink key={it.href} it={it} />
              ))}
          </NavGroup>
        )}
      </div>

      <div className="mt-auto space-y-4 pt-6">
        {!isAdmin && (
          <NavLink
            it={{ href: "/orgs", label: "Organizations", icon: Building2 }}
          />
        )}
        {!isAdmin &&
        subscription?.status === "TRIALING" &&
        trialEndDate ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="text-[10px] font-bold tracking-[0.22em] text-primary/75">
              Trial Access
            </div>
            <div className="mt-2 text-sm font-semibold text-foreground">
              Full access is active until {trialEndDate}.
            </div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              Your organization is currently on trial. Explore all premium
              features before the trial ends.
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
