import { PlanType } from "@prisma/client"

export type TenderLifecycleAccess =
  | "open"
  | "awarded"
  | "closed"
  | "cancelled"

export type PlanConfig = {
  monthlyPriceCents: number
  maxWatchlist: number | "unlimited"
  maxAiQueries: number | "unlimited"
  workspace: boolean
  compare: boolean
  exports: boolean
  whatsapp: boolean
  risk: boolean
  maxMembers: number | "unlimited" | "seats"
  tenderLifecycleAccess: TenderLifecycleAccess[]
  emailAlerts: "basic" | "advanced"
  customAlertRules: boolean
}

export const ALL_TENDER_LIFECYCLES: TenderLifecycleAccess[] = [
  "open",
  "awarded",
  "closed",
  "cancelled",
]

export const PLAN_CONFIG: Record<PlanType, PlanConfig> = {
  TRIAL: {
    monthlyPriceCents: 0,
    maxWatchlist: "unlimited",
    maxAiQueries: "unlimited",
    workspace: true,
    compare: true,
    exports: true,
    whatsapp: true,
    risk: true,
    maxMembers: "unlimited",
    tenderLifecycleAccess: ["open", "awarded", "closed", "cancelled"],
    emailAlerts: "advanced",
    customAlertRules: true,
  },
  PRO: {
    monthlyPriceCents: 29900,
    maxWatchlist: "unlimited",
    maxAiQueries: "unlimited",
    workspace: true,
    compare: true,
    exports: true,
    whatsapp: true,
    risk: true,
    maxMembers: 5,
    tenderLifecycleAccess: ["open", "awarded", "closed", "cancelled"],
    emailAlerts: "advanced",
    customAlertRules: true,
  },
  ENTERPRISE: {
    monthlyPriceCents: 149900,
    maxWatchlist: "unlimited",
    maxAiQueries: "unlimited",
    workspace: true,
    compare: true,
    exports: true,
    whatsapp: true,
    risk: true,
    maxMembers: 15,
    tenderLifecycleAccess: ["open", "awarded", "closed", "cancelled"],
    emailAlerts: "advanced",
    customAlertRules: true,
  },
}

export const EXPIRED_READONLY_PLAN_CONFIG: PlanConfig = {
  monthlyPriceCents: 0,
  maxWatchlist: 0,
  maxAiQueries: 0,
  workspace: false,
  compare: false,
  exports: false,
  whatsapp: false,
  risk: false,
  maxMembers: 0,
  tenderLifecycleAccess: [...ALL_TENDER_LIFECYCLES],
  emailAlerts: "basic",
  customAlertRules: false,
}
