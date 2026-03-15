import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"
import { trackBillingEvent } from "../../billing/analytics.service"
import { getEffectivePlanConfig } from "../../billing/effective-plan.service"
import { buildDefaultWatchlistReminderTypes } from "./watchlist.defaults"

export interface WatchlistTemplate {
  id: string
  name: string
  description: string
  keywords: string[]
}

export async function listTemplates(): Promise<WatchlistTemplate[]> {
  const categories = await prisma.tender.findMany({
    select: { category: true },
    distinct: ["category"],
    where: { category: { not: null } },
  })

  return categories.map((c) => ({
    id: `cat-${Buffer.from(c.category!).toString("hex")}`,
    name: c.category!,
    description: `Monitor all tenders under the ${c.category} category.`,
    keywords: [c.category!],
  }))
}

export async function getTemplateById(
  templateId: string,
): Promise<WatchlistTemplate | null> {
  if (templateId.startsWith("cat-")) {
    const category = Buffer.from(templateId.slice(4), "hex").toString()
    return {
      id: templateId,
      name: category,
      description: `Monitor all tenders under the ${category} category.`,
      keywords: [category],
    }
  }
  return null
}

function toTemplateRuleName(template: WatchlistTemplate) {
  return `Template: ${template.name}`
}

export async function selectTemplateForTender(input: string) {
  const haystack = input.toLowerCase()
  const templates = await listTemplates()
  let bestTemplate = templates[0] || null
  let bestScore = -1

  for (const template of templates) {
    const score = template.keywords.reduce((acc, keyword) => {
      return haystack.includes(keyword.toLowerCase()) ? acc + 1 : acc
    }, 0)

    if (score > bestScore) {
      bestTemplate = template
      bestScore = score
    }
  }

  return bestTemplate
}

export async function ensureTemplateAlertRule(args: {
  orgId: string
  templateId: string
}) {
  const template = await getTemplateById(args.templateId)
  if (!template) {
    throw new AppError("VALIDATION_ERROR", "Template not found", 400)
  }

  const existing = await prisma.alertRule.findFirst({
    where: {
      orgId: args.orgId,
      name: toTemplateRuleName(template),
    },
    select: { id: true },
  })

  if (existing) {
    return { alertRuleId: existing.id, template, created: false as const }
  }

  const alert = await prisma.alertRule.create({
    data: {
      orgId: args.orgId,
      name: toTemplateRuleName(template),
      isEnabled: true,
      eventTypes: ["TENDER_CHANGED", "SUMMARY_CREATED"],
      keywords: template.keywords,
    },
  })

  return { alertRuleId: alert.id, template, created: true as const }
}

export async function applyTemplate(args: {
  orgId: string
  userId: string
  templateId: string
}) {
  const out = await ensureTemplateAlertRule({
    orgId: args.orgId,
    templateId: args.templateId,
  })

  // Backfill: Add existing tenders in this category to watchlist
  const { config: cfg } = await getEffectivePlanConfig(args.orgId)
  const currentCount = await prisma.watchlistItem.count({
    where: { orgId: args.orgId },
  })

  if (cfg.maxWatchlist !== "unlimited" && currentCount >= cfg.maxWatchlist) {
    await trackBillingEvent({
      orgId: args.orgId,
      userId: args.userId,
      name: "watchlist_limit_hit",
      meta: { used: currentCount, limit: cfg.maxWatchlist, source: "template" },
    }).catch(() => undefined)
    throw new AppError(
      "PLAN_LIMIT_REACHED",
      `Your current plan allows up to ${cfg.maxWatchlist} watched tenders. Upgrade to add more.`,
      403,
      {
        upgrade: true,
        limitType: "watchlist",
        used: currentCount,
        limit: cfg.maxWatchlist,
      },
    )
  }

  const remainingSlots =
    cfg.maxWatchlist === "unlimited"
      ? 20
      : Math.max(0, cfg.maxWatchlist - currentCount)

  const matchingTenders = await prisma.tender.findMany({
    where: {
      category: out.template.name,
    },
    take: Math.max(1, Math.min(20, remainingSlots)),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      deadlines: {
        select: {
          briefingAt: true,
        },
      },
    },
  })

  let addedCount = 0
  for (const tender of matchingTenders) {
    if (cfg.maxWatchlist !== "unlimited" && currentCount + addedCount >= cfg.maxWatchlist) {
      break
    }
    try {
      await prisma.watchlistItem.create({
        data: {
          orgId: args.orgId,
          userId: args.userId,
          tenderId: tender.id,
          templateId: args.templateId,
          reminderTypes: buildDefaultWatchlistReminderTypes({
            hasBriefingSession: Boolean(tender.deadlines?.briefingAt),
          }),
        },
      })
      addedCount++
    } catch (e) {
      // Ignore unique constraint errors (already watching)
    }
  }

  return {
    alertRuleId: out.alertRuleId,
    keywords: out.template.keywords,
    templateId: out.template.id,
    addedCount,
  }
}
