import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"
import { Prisma } from "@prisma/client"
import crypto from "crypto"
import { logger } from "../../utils/logger"
import { trackBillingEvent } from "../../billing/analytics.service"
import { getEffectivePlanConfig } from "../../billing/effective-plan.service"
import {
  ensureTemplateAlertRule,
  getTemplateById,
  selectTemplateForTender,
} from "./templates.service"
import { buildDefaultWatchlistReminderTypes } from "./watchlist.defaults"

export const WATCHLIST_REMINDER_TYPES = [
  "CLOSING_7D",
  "CLOSING_24H",
  "CLOSING_2H",
  "SITE_VISIT",
] as const

export type WatchlistReminderType = (typeof WATCHLIST_REMINDER_TYPES)[number]

export const WATCHLIST_NOTIFICATION_CHANNELS = ["email", "whatsapp"] as const
export type WatchlistNotificationChannel =
  (typeof WATCHLIST_NOTIFICATION_CHANNELS)[number]

const DEFAULT_WATCHLIST_NOTIFICATION_CHANNELS: WatchlistNotificationChannel[] = [
  "email",
]

type LegacyWatchlistRow = {
  id: string
  orgId: string
  userId: string
  tenderId: string
  createdAt: Date
}

type LegacyWatchlistWithTenderRow = LegacyWatchlistRow & {
  title: string | null
  source: string | null
}

type TenderMetadataRow = {
  id: string
  closingDate: string | null
  companyName: string | null
}

async function resolvePlanConfig(orgId: string) {
  const { config } = await getEffectivePlanConfig(orgId)
  return config
}

async function enforceWatchlistLimit(args: { orgId: string; userId: string }) {
  const cfg = await resolvePlanConfig(args.orgId)
  if (cfg.maxWatchlist === "unlimited") return

  const currentCount = await prisma.watchlistItem.count({
    where: { orgId: args.orgId },
  })

  if (currentCount >= cfg.maxWatchlist) {
    await trackBillingEvent({
      orgId: args.orgId,
      userId: args.userId,
      name: "watchlist_limit_hit",
      meta: { used: currentCount, limit: cfg.maxWatchlist },
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
}

async function enforceWatchlistChannelPolicy(args: {
  orgId: string
  userId: string
  notificationChannels: WatchlistNotificationChannel[]
}) {
  const cfg = await resolvePlanConfig(args.orgId)
  if (cfg.whatsapp) return
  if (!args.notificationChannels.includes("whatsapp")) return

  await trackBillingEvent({
    orgId: args.orgId,
    userId: args.userId,
    name: "alerts_limit_hit",
    meta: { reason: "WHATSAPP_NOT_IN_PLAN", allowed: ["email"] },
  }).catch(() => undefined)

  throw new AppError(
    "PLAN_UPGRADE_REQUIRED",
    "SMS alerts are not available on your current plan.",
    403,
    {
      upgrade: true,
      limitType: "alerts",
      allowedChannels: ["email"],
    },
  )
}

function isMissingTemplateIdColumnError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : ""

  if (message.includes('column "templateId" does not exist')) return true
  if (message.includes("The column `WatchlistItem.templateId` does not exist"))
    return true
  if (message.includes('column "reminderTypes" does not exist')) return true
  if (
    message.includes("The column `WatchlistItem.reminderTypes` does not exist")
  )
    return true
  if (message.includes('column "notificationChannels" does not exist'))
    return true
  if (
    message.includes(
      "The column `WatchlistItem.notificationChannels` does not exist",
    )
  )
    return true

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022"
  ) {
    return true
  }

  return false
}

async function getTenderMetadataRows(args: {
  tenderIds: string[]
}): Promise<TenderMetadataRow[]> {
  if (args.tenderIds.length === 0) return []

  return prisma.$queryRaw<TenderMetadataRow[]>(Prisma.sql`
    SELECT
      "id",
      "closingDate",
      "companyName"
    FROM "Tender"
    WHERE "id" IN (${Prisma.join(args.tenderIds)})
  `)
}

async function upsertLegacyWatchlistItem(args: {
  orgId: string
  userId: string
  tenderId: string
}) {
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO "WatchlistItem" ("id", "orgId", "userId", "tenderId", "createdAt")
    VALUES (${crypto.randomUUID()}, ${args.orgId}, ${args.userId}, ${args.tenderId}, NOW())
    ON CONFLICT ("userId", "tenderId") DO NOTHING
  `)

  const rows = await prisma.$queryRaw<LegacyWatchlistRow[]>(Prisma.sql`
    SELECT "id", "orgId", "userId", "tenderId", "createdAt"
    FROM "WatchlistItem"
    WHERE "orgId" = ${args.orgId}
      AND "userId" = ${args.userId}
      AND "tenderId" = ${args.tenderId}
    LIMIT 1
  `)

  const row = rows[0]
  if (!row) {
    throw new AppError("INTERNAL_ERROR", "Failed to upsert watchlist item", 500)
  }

  return row
}

export async function addToWatchlist(args: {
  orgId: string
  userId: string
  tenderId: string
  templateId?: string
}) {
  const tender = await prisma.tender.findFirst({
    where: { id: args.tenderId },
    select: {
      title: true,
      source: true,
      deadlines: {
        select: {
          briefingAt: true,
        },
      },
    },
  })

  if (!tender) {
    throw new AppError("NOT_FOUND", "Tender not found", 404)
  }

  const existing = await prisma.watchlistItem.findFirst({
    where: {
      orgId: args.orgId,
      userId: args.userId,
      tenderId: args.tenderId,
    },
    select: { id: true },
  })
  if (!existing) {
    await enforceWatchlistLimit({ orgId: args.orgId, userId: args.userId })
  }

  const selectedTemplate = args.templateId
    ? await getTemplateById(args.templateId)
    : await selectTemplateForTender(`${tender.title} ${tender.source ?? ""}`)

  if (!selectedTemplate) {
    throw new AppError("VALIDATION_ERROR", "Category not found", 400)
  }

  let item:
    | {
        id: string
        orgId: string
        userId: string
        tenderId: string
        templateId: string
        createdAt: Date
      }
    | LegacyWatchlistRow

  try {
    const reminderTypes =
      buildDefaultWatchlistReminderTypes() as WatchlistReminderType[]

    item = await prisma.watchlistItem.upsert({
      where: {
        userId_tenderId: { userId: args.userId, tenderId: args.tenderId },
      },
      update: { templateId: selectedTemplate.id },
      create: {
        orgId: args.orgId,
        userId: args.userId,
        tenderId: args.tenderId,
        templateId: selectedTemplate.id,
        reminderTypes,
        notificationChannels: DEFAULT_WATCHLIST_NOTIFICATION_CHANNELS,
      },
    })
  } catch (error) {
    if (!isMissingTemplateIdColumnError(error)) {
      throw error
    }

    item = await upsertLegacyWatchlistItem({
      orgId: args.orgId,
      userId: args.userId,
      tenderId: args.tenderId,
    })
  }

  let alertRuleId: string | null = null
  try {
    const templateRule = await ensureTemplateAlertRule({
      orgId: args.orgId,
      templateId: selectedTemplate.id,
    })
    alertRuleId = templateRule.alertRuleId
  } catch (error) {
    logger.warn(
      {
        orgId: args.orgId,
        tenderId: args.tenderId,
        templateId: selectedTemplate.id,
        err: error,
      },
      "watchlist_alert_rule_provision_failed",
    )
  }

  return {
    item: {
      id: item.id,
      orgId: item.orgId,
      userId: item.userId,
      tenderId: item.tenderId,
      createdAt: item.createdAt,
      templateId: "templateId" in item ? item.templateId : selectedTemplate.id,
    },
    template: {
      id: selectedTemplate.id,
      name: selectedTemplate.name,
      keywords: selectedTemplate.keywords,
    },
    alertRuleId,
  }
}

export async function removeFromWatchlist(args: {
  orgId: string
  userId: string
  tenderId: string
}) {
  const item = await prisma.watchlistItem.findFirst({
    select: { id: true },
    where: { orgId: args.orgId, userId: args.userId, tenderId: args.tenderId },
  })
  if (!item) return { removed: false }
  await prisma.watchlistItem.delete({ where: { id: item.id } })
  return { removed: true }
}

export async function bulkRemoveFromWatchlist(args: {
  orgId: string
  userId: string
  tenderIds: string[]
}) {
  const result = await prisma.watchlistItem.deleteMany({
    where: {
      orgId: args.orgId,
      userId: args.userId,
      tenderId: { in: args.tenderIds },
    },
  })
  return { count: result.count }
}

export async function updateWatchlistItem(args: {
  orgId: string
  userId: string
  tenderId: string
  notes?: string
  reminderTypes?: WatchlistReminderType[]
  notificationChannels?: WatchlistNotificationChannel[]
}) {
  const item = await prisma.watchlistItem.findFirst({
    where: { orgId: args.orgId, userId: args.userId, tenderId: args.tenderId },
    select: { id: true },
  })

  if (!item) {
    throw new AppError("NOT_FOUND", "Watchlist item not found", 404)
  }

  const data: {
    notes?: string
    reminderTypes?: string[]
    notificationChannels?: string[]
  } = {}
  if (args.notes !== undefined) data.notes = args.notes
  if (args.reminderTypes !== undefined) data.reminderTypes = args.reminderTypes
  if (args.notificationChannels !== undefined) {
    await enforceWatchlistChannelPolicy({
      orgId: args.orgId,
      userId: args.userId,
      notificationChannels: args.notificationChannels,
    })
    data.notificationChannels = args.notificationChannels
  }

  return await prisma.watchlistItem.update({
    where: { id: item.id },
    data,
  })
}

export async function listWatchlist(args: { orgId: string; userId: string }) {
  try {
    const rows = (await prisma.watchlistItem.findMany({
      where: { orgId: args.orgId, userId: args.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orgId: true,
        userId: true,
        tenderId: true,
        createdAt: true,
        templateId: true,
        notes: true,
        reminderTypes: true,
        notificationChannels: true,
        tender: {
          select: {
            title: true,
            deadlines: {
              select: {
                closingAt: true,
              },
            },
          },
        },
      },
    })) as any[]

    const metadataRows = await getTenderMetadataRows({
      tenderIds: rows.map((row) => row.tenderId),
    })
    const metadataByTenderId = new Map(
      metadataRows.map((row) => [row.id, row]),
    )

    return rows.map((row) => ({
      id: row.id,
      orgId: row.orgId,
      userId: row.userId,
      tenderId: row.tenderId,
      createdAt: row.createdAt,
      templateId: row.templateId,
      notes: row.notes,
      reminderTypes: row.reminderTypes,
      notificationChannels: row.notificationChannels,
      tenderTitle: row.tender?.title ?? null,
      closingDate:
        row.tender?.deadlines?.closingAt?.toISOString() ??
        metadataByTenderId.get(row.tenderId)?.closingDate ??
        null,
      companyName: metadataByTenderId.get(row.tenderId)?.companyName ?? null,
    }))
  } catch (error) {
    if (!isMissingTemplateIdColumnError(error)) {
      throw error
    }

    const legacyRows = (await prisma.$queryRaw<any[]>(Prisma.sql`
      SELECT
        w."id",
        w."orgId",
        w."userId",
        w."tenderId",
        w."createdAt",
        t."title",
        t."source"
      FROM "WatchlistItem" w
      LEFT JOIN "Tender" t ON t."id" = w."tenderId"
      WHERE w."orgId" = ${args.orgId}
        AND w."userId" = ${args.userId}
      ORDER BY w."createdAt" DESC
    `)) as any[]

    const metadataRows = await getTenderMetadataRows({
      tenderIds: legacyRows.map((row) => row.tenderId),
    })
    const metadataByTenderId = new Map(
      metadataRows.map((row) => [row.id, row]),
    )

    return await Promise.all(
      legacyRows.map(async (row) => {
        const template = await selectTemplateForTender(
          `${row.title ?? ""} ${row.source ?? ""}`,
        )

        return {
          id: row.id,
          orgId: row.orgId,
          userId: row.userId,
          tenderId: row.tenderId,
          createdAt: row.createdAt,
          templateId: template?.id ?? "unknown-template",
          reminderTypes: [],
          notificationChannels: ["email"],
          tenderTitle: row.title,
          closingDate: metadataByTenderId.get(row.tenderId)?.closingDate ?? null,
          companyName: metadataByTenderId.get(row.tenderId)?.companyName ?? null,
        }
      }),
    )
  }
}

export async function isWatched(args: {
  orgId: string
  userId: string
  tenderId: string
}) {
  const item = await prisma.watchlistItem.findFirst({
    select: { id: true },
    where: { orgId: args.orgId, userId: args.userId, tenderId: args.tenderId },
  })
  return Boolean(item)
}
