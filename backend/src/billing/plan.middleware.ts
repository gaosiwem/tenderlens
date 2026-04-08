import {
  ALL_TENDER_LIFECYCLES,
  PLAN_CONFIG,
  type TenderLifecycleAccess,
} from "./plan"
import { AppError } from "../utils/responses"
import { prisma } from "../db/prisma"
import { getEffectivePlanConfig, isBusinessPlan } from "./effective-plan.service"

type RequestedLifecycle = TenderLifecycleAccess | "all"

function normalizeRequestedLifecycle(value?: string | null): RequestedLifecycle {
  switch (String(value ?? "open").trim().toLowerCase()) {
    case "awarded":
      return "awarded"
    case "closed":
      return "closed"
    case "cancelled":
      return "cancelled"
    case "all":
      return "all"
    case "open":
    default:
      return "open"
  }
}

async function resolveActivePlanConfig(orgId: string) {
  const { subscription: sub, config } = await getEffectivePlanConfig(orgId)

  if (!sub) throw new AppError("PLAN_REQUIRED", "Subscription required", 403)

  if (sub.status === "EXPIRED") {
    throw new AppError("PLAN_EXPIRED", "Subscription expired", 403, {
      upgrade: true,
    })
  }

  if (sub.status === "PAST_DUE") {
    const isGraceEnded = sub.graceEndsAt && new Date() > sub.graceEndsAt
    if (isGraceEnded) {
      throw new AppError(
        "PLAN_PAST_DUE",
        "Subscription past due and grace period ended",
        403,
        { upgrade: true },
      )
    }
  }

  return { sub, config }
}

async function resolveTenderHistoryConfig(orgId: string) {
  const { subscription: sub, config } = await getEffectivePlanConfig(orgId)

  if (!sub) throw new AppError("PLAN_REQUIRED", "Subscription required", 403)

  if (sub.status === "PAST_DUE") {
    const isGraceEnded = sub.graceEndsAt && new Date() > sub.graceEndsAt
    if (isGraceEnded) {
      throw new AppError(
        "PLAN_PAST_DUE",
        "Subscription past due and grace period ended",
        403,
        { upgrade: true },
      )
    }
  }

  return {
    sub,
    allowedLifecycles:
      sub.status === "EXPIRED"
        ? ALL_TENDER_LIFECYCLES
        : config.tenderLifecycleAccess,
  }
}

export async function requirePlanFeature(
  orgId: string,
  feature: keyof (typeof PLAN_CONFIG)["TRIAL"],
) {
  const { config } = await resolveActivePlanConfig(orgId)

  if (!(config as any)[feature]) {
    throw new AppError(
      "PLAN_UPGRADE_REQUIRED",
      "Upgrade plan to access this feature",
      403,
      { upgrade: true },
    )
  }
}

export async function requireBusinessPlan(orgId: string) {
  const sub = await prisma.orgSubscription.findUnique({
    where: { orgId },
    select: { plan: true },
  })

  if (isBusinessPlan(sub?.plan)) return

  throw new AppError(
    "PLAN_UPGRADE_REQUIRED",
    "This feature is available on the BUSINESS plan.",
    403,
    { upgrade: true, limitType: "business" },
  )
}

export async function requireTenderLifecycleAccess(
  orgId: string,
  lifecycle?: string | null,
) {
  const { config } = await resolveActivePlanConfig(orgId)
  const requested = normalizeRequestedLifecycle(lifecycle)
  const required =
    requested === "all"
      ? (["open", "awarded", "closed", "cancelled"] as TenderLifecycleAccess[])
      : [requested]

  const allowed = new Set(config.tenderLifecycleAccess)
  const blocked = required.filter((item) => !allowed.has(item))
  if (blocked.length === 0) return

  throw new AppError(
    "PLAN_UPGRADE_REQUIRED",
    `Your plan does not include ${blocked.join(", ")} tenders.`,
    403,
    {
      upgrade: true,
      limitType: "tender_lifecycle",
      requestedLifecycle: requested,
      allowedLifecycles: config.tenderLifecycleAccess,
    },
  )
}

export async function requireTenderReadOnlyLifecycleAccess(
  orgId: string,
  lifecycle?: string | null,
) {
  const { allowedLifecycles } = await resolveTenderHistoryConfig(orgId)
  const requested = normalizeRequestedLifecycle(lifecycle)
  const required =
    requested === "all"
      ? (["open", "awarded", "closed", "cancelled"] as TenderLifecycleAccess[])
      : [requested]

  const allowed = new Set(allowedLifecycles)
  const blocked = required.filter((item) => !allowed.has(item))
  if (blocked.length === 0) return

  throw new AppError(
    "PLAN_UPGRADE_REQUIRED",
    `Your plan does not include ${blocked.join(", ")} tenders.`,
    403,
    {
      upgrade: true,
      limitType: "tender_lifecycle",
      requestedLifecycle: requested,
      allowedLifecycles,
    },
  )
}

export async function enforceBillingWriteAccess(orgId: string) {
  const sub = await prisma.orgSubscription.findUnique({ where: { orgId } })
  if (!sub) return

  if (sub.status === "EXPIRED") {
    throw new AppError(
      "PLAN_EXPIRED",
      "Subscription expired. Read-only access only.",
      403,
      { upgrade: true },
    )
  }

  if (sub.status === "PAST_DUE") {
    const isGraceEnded = sub.graceEndsAt && new Date() > sub.graceEndsAt
    if (isGraceEnded) {
      throw new AppError(
        "PLAN_PAST_DUE",
        "Subscription past due and grace period ended",
        403,
        { upgrade: true },
      )
    }
  }
}

export async function enforceTrial(orgId: string) {
  const sub = await prisma.orgSubscription.findUnique({ where: { orgId } })
  if (!sub) return

  if (
    sub.status === "TRIALING" &&
    sub.trialEndsAt &&
    new Date() > sub.trialEndsAt
  ) {
    await prisma.orgSubscription.update({
      where: { orgId },
      data: { status: "EXPIRED" },
    })
    throw new AppError(
      "TRIAL_EXPIRED",
      "Trial expired. Upgrade to continue.",
      403,
      { upgrade: true },
    )
  }
}
