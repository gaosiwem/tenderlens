import { NotificationType, Prisma } from "@prisma/client"
import { env } from "../../config/env"
import { prisma } from "../../db/prisma"
import { emitEvent } from "../notifications/notifications.service"
import {
  WATCHLIST_NOTIFICATION_CHANNELS,
  WATCHLIST_REMINDER_TYPES,
} from "../watchlist/watchlist.service"
import { backfillBriefingReminderForTenderWatchers } from "../watchlist/watchlist.defaults"

const watchlistReminderTypeSet = new Set<string>(WATCHLIST_REMINDER_TYPES)
const watchlistNotificationChannelSet = new Set<string>(
  WATCHLIST_NOTIFICATION_CHANNELS,
)

const DEFAULT_URGENT_WATCHLIST_REMINDER_TYPES = new Set<string>(["CLOSING_2H"])
const DEFAULT_BATCHED_WATCHLIST_REMINDER_TYPES = new Set<string>([
  "CLOSING_7D",
  "CLOSING_24H",
  "BRIEFING_SESSION",
  "SITE_VISIT",
])

const urgentWatchlistReminderTypeSet = resolveConfiguredReminderTypeSet(
  env.WATCHLIST_URGENT_REMINDER_TYPES,
  DEFAULT_URGENT_WATCHLIST_REMINDER_TYPES,
)
const batchedWatchlistReminderTypeSet = resolveConfiguredReminderTypeSet(
  env.WATCHLIST_BATCHED_REMINDER_TYPES,
  DEFAULT_BATCHED_WATCHLIST_REMINDER_TYPES,
)

type ReminderTenderMeta = {
  tenderTitle: string | null
  companyName: string | null
  closingDate: string | null
}

type ReminderRecord = {
  id: string
  orgId: string
  userId: string | null
  tenderId: string
  type: string
  fireAt: Date
}

type WatchlistBatchItem = {
  tenderId: string
  reminderType: string
  fireAt: Date
  tenderMeta: ReminderTenderMeta
}

type WatchlistBatchBucket = {
  orgId: string
  userId: string
  windowStart: Date
  windowEnd: Date
  targetChannels: Set<"email" | "whatsapp">
  items: WatchlistBatchItem[]
  itemKeys: Set<string>
}

function normalizeWatchlistChannels(channels: string[] | null | undefined) {
  const cleaned = (channels ?? []).filter((channel) =>
    watchlistNotificationChannelSet.has(channel),
  ) as Array<"email" | "whatsapp">

  return cleaned.length > 0 ? cleaned : (["email"] as Array<"email" | "whatsapp">)
}

function resolveConfiguredReminderTypeSet(
  raw: string | null | undefined,
  fallback: Set<string>,
) {
  const parsed = String(raw ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .filter((v) => watchlistReminderTypeSet.has(v))

  if (parsed.length === 0) return new Set(fallback)
  return new Set(parsed)
}

function isUrgentWatchlistReminderType(type: string) {
  if (urgentWatchlistReminderTypeSet.has(type)) return true
  if (batchedWatchlistReminderTypeSet.has(type)) return false
  return type === "CLOSING_2H"
}

function shouldBatchWatchlistReminderType(type: string) {
  if (isUrgentWatchlistReminderType(type)) return false
  if (batchedWatchlistReminderTypeSet.has(type)) return true
  return watchlistReminderTypeSet.has(type)
}

function getStartOfUtcDay(now: Date) {
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  return start
}

function getWatchlistBatchWindow(fireAt: Date) {
  const configured = Number(env.WATCHLIST_BATCH_WINDOW_MINUTES)
  const windowMinutes = Number.isFinite(configured)
    ? Math.max(5, configured)
    : 30
  const windowMs = windowMinutes * 60_000
  const startMs = Math.floor(fireAt.getTime() / windowMs) * windowMs
  const windowStart = new Date(startMs)
  const windowEnd = new Date(startMs + windowMs)
  return { windowStart, windowEnd }
}

function buildWatchlistBatchKey(args: {
  orgId: string
  userId: string
  windowStart: Date
}) {
  return `${args.orgId}:${args.userId}:${args.windowStart.toISOString()}`
}

function addToWatchlistBatch(args: {
  buckets: Map<string, WatchlistBatchBucket>
  orgId: string
  userId: string
  tenderId: string
  reminderType: string
  fireAt: Date
  tenderMeta: ReminderTenderMeta
  targetChannels: Array<"email" | "whatsapp">
}) {
  const { windowStart, windowEnd } = getWatchlistBatchWindow(args.fireAt)
  const key = buildWatchlistBatchKey({
    orgId: args.orgId,
    userId: args.userId,
    windowStart,
  })

  let bucket = args.buckets.get(key)
  if (!bucket) {
    bucket = {
      orgId: args.orgId,
      userId: args.userId,
      windowStart,
      windowEnd,
      targetChannels: new Set(),
      items: [],
      itemKeys: new Set(),
    }
    args.buckets.set(key, bucket)
  }

  for (const channel of args.targetChannels) {
    bucket.targetChannels.add(channel)
  }

  const itemKey = `${args.tenderId}:${args.reminderType}`
  if (bucket.itemKeys.has(itemKey)) return

  bucket.itemKeys.add(itemKey)
  bucket.items.push({
    tenderId: args.tenderId,
    reminderType: args.reminderType,
    fireAt: args.fireAt,
    tenderMeta: args.tenderMeta,
  })
}

async function getReminderTenderMeta(args: {
  orgId: string
  tenderId: string
}): Promise<ReminderTenderMeta> {
  const tender = await prisma.tender.findFirst({
    where: {
      id: args.tenderId,
      orgId: args.orgId,
    },
    select: {
      title: true,
      companyName: true,
      closingDate: true,
      deadlines: {
        select: { closingAt: true },
      },
    },
  })

  if (!tender) {
    return {
      tenderTitle: null,
      companyName: null,
      closingDate: null,
    }
  }

  return {
    tenderTitle: tender.title ?? null,
    companyName: tender.companyName ?? null,
    closingDate:
      tender.deadlines?.closingAt?.toISOString() ?? tender.closingDate ?? null,
  }
}

async function emitSingleWatchlistReminder(args: {
  orgId: string
  userId: string
  tenderId: string
  reminderType: string
  tenderMeta: ReminderTenderMeta
  targetChannels: Array<"email" | "whatsapp">
}) {
  await emitEvent({
    orgId: args.orgId,
    type: NotificationType.ALERT_FIRED,
    entityType: "Tender",
    entityId: args.tenderId,
    targetChannels: args.targetChannels,
    ignoreEventTypePrefs: true,
    ignoreChannelPrefs: true,
    meta: {
      ...args.tenderMeta,
      kind: "WATCHLIST_REMINDER",
      reminderType: args.reminderType,
      tenderId: args.tenderId,
      toUserId: args.userId,
    },
  })
}

async function emitNonWatchlistReminder(r: ReminderRecord) {
  const tenderMeta = await getReminderTenderMeta({
    orgId: r.orgId,
    tenderId: r.tenderId,
  })

  await emitEvent({
    orgId: r.orgId,
    type: NotificationType.ALERT_FIRED,
    entityType: "Tender",
    entityId: r.tenderId,
    meta: {
      ...tenderMeta,
      kind: "DEADLINE_REMINDER",
      reminderType: r.type,
      tenderId: r.tenderId,
    },
  })
}

async function collectWatchlistCandidatesForReminder(args: {
  reminder: ReminderRecord
  buckets: Map<string, WatchlistBatchBucket>
}) {
  const r = args.reminder
  const tenderMeta = await getReminderTenderMeta({
    orgId: r.orgId,
    tenderId: r.tenderId,
  })

  const queueOrSend = async (watcher: {
    userId: string
    notificationChannels: string[] | null | undefined
  }) => {
    const targetChannels = normalizeWatchlistChannels(watcher.notificationChannels)
    if (targetChannels.length === 0) return

    if (shouldBatchWatchlistReminderType(r.type)) {
      addToWatchlistBatch({
        buckets: args.buckets,
        orgId: r.orgId,
        userId: watcher.userId,
        tenderId: r.tenderId,
        reminderType: r.type,
        fireAt: r.fireAt,
        tenderMeta,
        targetChannels,
      })
      return
    }

    await emitSingleWatchlistReminder({
      orgId: r.orgId,
      userId: watcher.userId,
      tenderId: r.tenderId,
      reminderType: r.type,
      tenderMeta,
      targetChannels,
    })
  }

  if (r.userId) {
    const watcher = await prisma.watchlistItem.findFirst({
      where: { orgId: r.orgId, tenderId: r.tenderId, userId: r.userId },
      select: { notificationChannels: true },
    })

    await queueOrSend({
      userId: r.userId,
      notificationChannels: watcher?.notificationChannels,
    })
    return
  }

  const watchers = await prisma.watchlistItem.findMany({
    where: {
      orgId: r.orgId,
      tenderId: r.tenderId,
      reminderTypes: { has: r.type },
    },
    select: { userId: true, notificationChannels: true },
  })

  for (const watcher of watchers) {
    await queueOrSend(watcher)
  }
}

async function countWatchlistEmailsSentToday(args: {
  orgId: string
  email: string
  dayStart: Date
}) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number | string }>>(
    Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "NotificationDelivery" d
      INNER JOIN "NotificationEvent" e
        ON e."id" = d."eventId"
      WHERE d."orgId" = ${args.orgId}
        AND d."channel" = 'email'
        AND d."to" = ${args.email}
        AND d."status" = 'SENT'
        AND d."createdAt" >= ${args.dayStart}
        AND COALESCE(e."meta"->>'kind', '') IN ('WATCHLIST_REMINDER', 'WATCHLIST_BATCH_SUMMARY')
    `,
  )

  const raw = rows[0]?.count ?? 0
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : 0
}

async function flushWatchlistBatches(
  buckets: Map<string, WatchlistBatchBucket>,
  now: Date,
) {
  if (!buckets.size) return

  const batchList = Array.from(buckets.values())
  batchList.sort((a, b) => a.windowStart.getTime() - b.windowStart.getTime())

  const userEmailCache = new Map<string, string | null>()
  const userEmailCountCache = new Map<string, number>()
  const dayStart = getStartOfUtcDay(now)
  const configuredEmailLimit = Number.isFinite(env.WATCHLIST_MAX_EMAILS_PER_DAY)
    ? Math.floor(env.WATCHLIST_MAX_EMAILS_PER_DAY)
    : 3
  const emailLimit =
    configuredEmailLimit > 0 ? configuredEmailLimit : Number.POSITIVE_INFINITY
  const maxTendersPerEmail = Number.isFinite(env.WATCHLIST_MAX_TENDERS_PER_EMAIL)
    ? Math.max(1, env.WATCHLIST_MAX_TENDERS_PER_EMAIL)
    : 10

  for (const batch of batchList) {
    const targetChannels = new Set(batch.targetChannels)
    if (targetChannels.has("email")) {
      const userKey = `${batch.orgId}:${batch.userId}`

      let email = userEmailCache.get(userKey)
      if (email === undefined) {
        const user = await prisma.user.findUnique({
          where: { id: batch.userId },
          select: { email: true },
        })
        email = user?.email ?? null
        userEmailCache.set(userKey, email)
      }

      if (!email) {
        targetChannels.delete("email")
      } else {
        let currentCount = userEmailCountCache.get(userKey)
        if (currentCount === undefined) {
          currentCount = await countWatchlistEmailsSentToday({
            orgId: batch.orgId,
            email,
            dayStart,
          })
          userEmailCountCache.set(userKey, currentCount)
        }

        if (currentCount >= emailLimit) {
          targetChannels.delete("email")
        } else {
          userEmailCountCache.set(userKey, currentCount + 1)
        }
      }
    }

    const sortedItems = [...batch.items].sort(
      (a, b) => a.fireAt.getTime() - b.fireAt.getTime(),
    )
    const visibleItems = sortedItems.slice(0, maxTendersPerEmail)
    const overflowCount = Math.max(0, sortedItems.length - visibleItems.length)
    const firstTenderId = visibleItems[0]?.tenderId
    const meta = {
      kind: "WATCHLIST_BATCH_SUMMARY",
      toUserId: batch.userId,
      tenderId: firstTenderId ?? null,
      totalItems: sortedItems.length,
      overflowCount,
      windowStart: batch.windowStart.toISOString(),
      windowEnd: batch.windowEnd.toISOString(),
      items: visibleItems.map((item) => ({
        tenderId: item.tenderId,
        tenderTitle: item.tenderMeta.tenderTitle,
        companyName: item.tenderMeta.companyName,
        closingDate: item.tenderMeta.closingDate,
        reminderType: item.reminderType,
      })),
    }

    if (targetChannels.size === 0) {
      await emitEvent({
        orgId: batch.orgId,
        type: NotificationType.ALERT_FIRED,
        entityType: firstTenderId ? "Tender" : undefined,
        entityId: firstTenderId,
        targetUserId: batch.userId,
        targetChannels: [],
        ignoreEventTypePrefs: true,
        ignoreChannelPrefs: true,
        meta: {
          ...meta,
          deliverySuppressed: "WATCHLIST_EMAIL_CAP_REACHED",
        },
      })
      continue
    }

    await emitEvent({
      orgId: batch.orgId,
      type: NotificationType.ALERT_FIRED,
      entityType: firstTenderId ? "Tender" : undefined,
      entityId: firstTenderId,
      targetChannels: Array.from(targetChannels),
      ignoreEventTypePrefs: true,
      ignoreChannelPrefs: true,
      meta,
    })
  }
}

async function upsertReminder(
  orgId: string,
  tenderId: string,
  type: any,
  fireAt: Date,
) {
  return prisma.tenderReminder.upsert({
    where: {
      tenderId_type_fireAt: {
        tenderId,
        type,
        fireAt,
      },
    },
    create: {
      orgId,
      tenderId,
      type,
      fireAt,
    },
    update: {},
  })
}

export async function scheduleReminders() {
  if (!env.REMINDERS_ENABLED) return

  const windows = env.REMINDER_WINDOWS_HOURS.split(",").map(Number)
  const tenders = await prisma.tender.findMany({
    where: {
      status: "COMPLETED",
    },
    include: { deadlines: true },
  })

  for (const tender of tenders) {
    if (!tender.deadlines || !tender.orgId) continue

    const { closingAt, briefingAt, siteVisitAt } = tender.deadlines

    if (closingAt && closingAt > new Date()) {
      for (const hours of windows) {
        const fireAt = new Date(closingAt.getTime() - hours * 60 * 60_000)
        if (fireAt <= new Date()) continue

        await upsertReminder(
          tender.orgId,
          tender.id,
          hours === 168
            ? "CLOSING_7D"
            : hours === 24
              ? "CLOSING_24H"
              : "CLOSING_2H",
          fireAt,
        )
      }
    }

    if (briefingAt) {
      await backfillBriefingReminderForTenderWatchers(tender.id)
      const fireAt = new Date(briefingAt.getTime() - 24 * 60 * 60_000)
      if (fireAt > new Date()) {
        await upsertReminder(
          tender.orgId,
          tender.id,
          "BRIEFING_SESSION",
          fireAt,
        )
      }
    }

    if (siteVisitAt) {
      const fireAt = new Date(siteVisitAt.getTime() - 24 * 60 * 60_000)
      if (fireAt > new Date()) {
        await upsertReminder(tender.orgId, tender.id, "SITE_VISIT", fireAt)
      }
    }
  }

  const tasksDueSoon = await prisma.bidTask.findMany({
    where: {
      status: { not: "DONE" },
      dueAt: {
        gt: new Date(),
        lt: new Date(Date.now() + 25 * 60 * 60_000),
      },
    },
    include: { workspace: true },
  })

  for (const task of tasksDueSoon) {
    const fireAt = new Date(task.dueAt!.getTime() - 24 * 60 * 60_000)
    if (fireAt <= new Date()) {
      await upsertReminder(
        task.workspace.orgId,
        task.workspace.tenderId,
        "TASK_DUE",
        new Date(),
      )
    } else {
      await upsertReminder(
        task.workspace.orgId,
        task.workspace.tenderId,
        "TASK_DUE",
        fireAt,
      )
    }
  }
}

export async function fireDueReminders() {
  const now = new Date()
  const due = await prisma.tenderReminder.findMany({
    where: {
      fireAt: { lte: now },
      firedAt: null,
    },
    select: {
      id: true,
      orgId: true,
      userId: true,
      tenderId: true,
      type: true,
      fireAt: true,
    },
  })

  const watchlistBatches = new Map<string, WatchlistBatchBucket>()
  for (const reminder of due) {
    await prisma.tenderReminder.update({
      where: { id: reminder.id },
      data: { firedAt: now },
    })

    if (watchlistReminderTypeSet.has(reminder.type)) {
      if (isUrgentWatchlistReminderType(reminder.type)) {
        await collectWatchlistCandidatesForReminder({
          reminder,
          buckets: new Map<string, WatchlistBatchBucket>(),
        })
      } else {
        await collectWatchlistCandidatesForReminder({
          reminder,
          buckets: watchlistBatches,
        })
      }
      continue
    }

    await emitNonWatchlistReminder(reminder)
  }

  await flushWatchlistBatches(watchlistBatches, now)
}

async function fireReminderRecord(r: ReminderRecord) {
  await prisma.tenderReminder.update({
    where: { id: r.id },
    data: { firedAt: new Date() },
  })

  if (!watchlistReminderTypeSet.has(r.type)) {
    await emitNonWatchlistReminder(r)
    return
  }

  const watchlistBatches = new Map<string, WatchlistBatchBucket>()
  if (isUrgentWatchlistReminderType(r.type)) {
    await collectWatchlistCandidatesForReminder({
      reminder: r,
      buckets: new Map<string, WatchlistBatchBucket>(),
    })
  } else {
    await collectWatchlistCandidatesForReminder({
      reminder: r,
      buckets: watchlistBatches,
    })
    await flushWatchlistBatches(watchlistBatches, new Date())
  }
}

export async function fireReminderById(id: string) {
  const reminder = await prisma.tenderReminder.findUnique({
    where: { id },
    select: {
      id: true,
      orgId: true,
      userId: true,
      tenderId: true,
      type: true,
      fireAt: true,
      firedAt: true,
    },
  })

  if (!reminder) return { fired: 0, reason: "NOT_FOUND" as const }
  if (reminder.firedAt) return { fired: 0, reason: "ALREADY_FIRED" as const }
  if (reminder.fireAt > new Date()) {
    return { fired: 0, reason: "NOT_DUE" as const }
  }

  await fireReminderRecord(reminder)
  return { fired: 1, reason: "FIRED" as const }
}
