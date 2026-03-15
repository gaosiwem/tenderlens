"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart3,
  Activity,
  Zap,
  ShieldCheck,
  LayoutDashboard,
  ChevronRight,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ADMIN_MODULES = [
  {
    name: "Revenue Intelligence",
    description: "Monitor platform growth, MRR, and subscription breakdowns.",
    href: "/admin/revenue",
    icon: BarChart3,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    name: "Billing Analytics",
    description:
      "Analyze billing events, conversions, and partner-attributed upgrades.",
    href: "/admin/billing-analytics",
    icon: Activity,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    name: "Scraper Control",
    description:
      "Trigger manual scraper jobs and monitor import health from eTenders.",
    href: "/admin/scraper",
    icon: Zap,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    name: "Alert Management",
    description: "Configure and manage AI-driven email notification rules.",
    href: "/admin/alerts",
    icon: ShieldCheck,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    name: "Referral Tracking",
    description: "Manage partner referral links and track payout eligibility.",
    href: "/admin/referrals",
    icon: LayoutDashboard,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    name: "Business Success",
    description:
      "Assign account managers, manage onboarding workflow, and update support SLAs.",
    href: "/admin/business",
    icon: Users,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
];

export default function AdminLandingPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-display font-extrabold tracking-tight">
          System <span className="text-primary">Center</span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Welcome to the TenderLens administrative core. Manage platform
          intelligence, control data ingestion, and monitor system-wide metrics
          from a unified interface.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADMIN_MODULES.map((module) => (
          <Link key={module.href} href={module.href} className="group">
            <Card className="h-full hover:border-primary/30 transition-all duration-300">
              <CardContent className="p-6 flex flex-col items-start gap-4">
                <div className={cn("p-3 rounded-xl", module.bg)}>
                  <module.icon className={cn("h-5 w-5", module.color)} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold group-hover:text-primary transition-colors flex items-center gap-2">
                    {module.name}
                    <ChevronRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {module.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
