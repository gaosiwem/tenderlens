export type PlanType =
  | "FREE"
  | "TRIAL"
  | "PRO"
  | "BUSINESS"
  | "ENTERPRISE";
export type SubscriptionStatus =
  | "ACTIVE"
  | "TRIALING"
  | "EXPIRED"
  | "PAST_DUE"
  | "CANCELED"
  | "INCOMPLETE";

export interface Subscription {
  id: string;
  orgId: string;
  plan: PlanType;
  status: SubscriptionStatus;
  trialEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  seatsPurchased?: number;
  seatsUsed?: number;
  pastDueSince?: string | null;
  graceEndsAt?: string | null;
  updatedAt: string;
}

export interface UsageLimits {
  maxAiQueries: number | "unlimited";
  maxWatchlist: number | "unlimited";
  maxMembers: number | "unlimited" | "seats";
  exportsEnabled: boolean;
  workspaceEnabled: boolean;
  compareEnabled: boolean;
  whatsappEnabled: boolean;
  riskEnabled: boolean;
  tenderLifecycleAccess?: ("open" | "awarded" | "closed" | "cancelled")[];
  emailAlerts?: "basic" | "advanced";
  customAlertRules?: boolean;
}

export interface Usage {
  month: string;
  aiQueries: number;
  exports: number;
  reminders: number;
  watchlistCount: number;
  limits: UsageLimits;
}

export function formatPlanDisplayName(
  plan?: PlanType | null,
  status?: SubscriptionStatus | null,
) {
  if (status === "TRIALING") return "Trial";

  switch (plan) {
    case "FREE":
    case "TRIAL":
      return "Trial";
    case "PRO":
      return "Professional";
    case "BUSINESS":
    case "ENTERPRISE":
      return "Business";
    default:
      return "Trial";
  }
}

export function formatPlanBadgeLabel(args: {
  plan?: PlanType | null;
  status?: SubscriptionStatus | null;
  isAdmin?: boolean;
}) {
  if (args.isAdmin) return "Admin";
  return formatPlanDisplayName(args.plan, args.status);
}
