import { prisma } from "../db/prisma"
import { PLAN_CONFIG, type PlanConfig } from "./plan"

function clonePlanConfig(config: PlanConfig): PlanConfig {
  return {
    ...config,
    tenderLifecycleAccess: [...config.tenderLifecycleAccess],
  }
}

export function isBusinessPlan(plan: string | null | undefined) {
  return plan === "ENTERPRISE"
}

export function applyBillingPolicyOverrides(
  baseConfig: PlanConfig,
  policy: {
    customMaxAiQueries?: number | null
    customMaxWatchlist?: number | null
    customMaxMembers?: number | null
    customExportsEnabled?: boolean | null
    customWorkspaceEnabled?: boolean | null
    customCompareEnabled?: boolean | null
    customWhatsappEnabled?: boolean | null
    customRiskEnabled?: boolean | null
  } | null,
): PlanConfig {
  const config = clonePlanConfig(baseConfig)
  if (!policy) return config

  if (
    Number.isInteger(policy.customMaxAiQueries) &&
    Number(policy.customMaxAiQueries) > 0
  ) {
    config.maxAiQueries = Number(policy.customMaxAiQueries)
  }

  if (
    Number.isInteger(policy.customMaxWatchlist) &&
    Number(policy.customMaxWatchlist) > 0
  ) {
    config.maxWatchlist = Number(policy.customMaxWatchlist)
  }

  if (
    Number.isInteger(policy.customMaxMembers) &&
    Number(policy.customMaxMembers) > 0
  ) {
    config.maxMembers = Number(policy.customMaxMembers)
  }

  if (typeof policy.customExportsEnabled === "boolean") {
    config.exports = policy.customExportsEnabled
  }
  if (typeof policy.customWorkspaceEnabled === "boolean") {
    config.workspace = policy.customWorkspaceEnabled
  }
  if (typeof policy.customCompareEnabled === "boolean") {
    config.compare = policy.customCompareEnabled
  }
  if (typeof policy.customWhatsappEnabled === "boolean") {
    config.whatsapp = policy.customWhatsappEnabled
  }
  if (typeof policy.customRiskEnabled === "boolean") {
    config.risk = policy.customRiskEnabled
  }

  return config
}

export async function getEffectivePlanConfig(orgId: string) {
  let sub = await prisma.orgSubscription.findUnique({
    where: { orgId },
  })

  // If no subscription, create one in TRIALING status (14 days)
  if (!sub) {
    const trialDays = 14
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays)

    sub = await prisma.orgSubscription.create({
      data: {
        orgId,
        plan: "PRO", // Trial counts as PRO features
        status: "TRIALING",
        trialEndsAt,
      },
    })
  }

  // If status is TRIALING, we treat it as ENTERPRISE plan ("access to everything")
  let planKey: keyof typeof PLAN_CONFIG
  if (sub.status === "TRIALING") {
    planKey = "ENTERPRISE"
  } else {
    planKey = (sub.plan ?? "TRIAL") as keyof typeof PLAN_CONFIG
  }

  const baseConfig = PLAN_CONFIG[planKey] ?? (PLAN_CONFIG as any).TRIAL ?? PLAN_CONFIG.PRO

  if (!isBusinessPlan(sub.plan) && sub.status !== "TRIALING") {
    return {
      subscription: sub,
      config: clonePlanConfig(baseConfig),
      policy: null,
    }
  }

  const policy = await prisma.orgBillingPolicy.findUnique({
    where: { orgId },
  })

  return {
    subscription: sub,
    config: applyBillingPolicyOverrides(baseConfig, policy),
    policy,
  }
}
