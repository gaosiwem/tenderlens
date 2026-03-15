import { prisma } from "../db/prisma"
import { AppError } from "../utils/responses"
import { trackBillingEvent } from "./analytics.service"
import { getEffectivePlanConfig } from "./effective-plan.service"

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export async function incrementUsage(
  orgId: string,
  key: "aiQueries" | "exports" | "reminders",
  userId?: string,
) {
  const month = currentMonth()

  const { config } = await getEffectivePlanConfig(orgId)

  const usage = await prisma.orgUsage.upsert({
    where: { orgId_month: { orgId, month } },
    create: { orgId, month },
    update: {},
  })

  const limit = key === "aiQueries" ? config.maxAiQueries : "unlimited"

  if (limit !== "unlimited" && (usage as any)[key] >= limit) {
    if (key === "aiQueries") {
      await trackBillingEvent({
        orgId,
        userId,
        name: "ai_limit_hit",
        meta: { key, used: (usage as any)[key], limit, month },
      }).catch(() => undefined)
    }
    throw new AppError("USAGE_LIMIT_REACHED", "Usage limit reached", 403, {
      upgrade: true,
      limitType: key,
      used: (usage as any)[key],
      limit,
    })
  }

  await prisma.orgUsage.update({
    where: { id: usage.id },
    data: { [key]: { increment: 1 } },
  })
}

export async function getUsageSummary(orgId: string) {
  const month = currentMonth()

  const { config } = await getEffectivePlanConfig(orgId)

  const usage = await prisma.orgUsage.findUnique({
    where: { orgId_month: { orgId, month } },
  })

  const watchlistCount = await prisma.watchlistItem.count({
    where: { orgId },
  })

  return {
    month,
    aiQueries: usage?.aiQueries || 0,
    exports: usage?.exports || 0,
    reminders: usage?.reminders || 0,
    watchlistCount,
    limits: {
      maxAiQueries: config.maxAiQueries,
      maxWatchlist: config.maxWatchlist,
      exportsEnabled: config.exports,
      workspaceEnabled: config.workspace,
      compareEnabled: config.compare,
      whatsappEnabled: config.whatsapp,
      riskEnabled: config.risk,
      maxMembers: config.maxMembers,
      tenderLifecycleAccess: config.tenderLifecycleAccess,
      emailAlerts: config.emailAlerts,
      customAlertRules: config.customAlertRules,
    },
  }
}
