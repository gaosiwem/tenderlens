import cron from "node-cron"
import { prisma } from "../db/prisma"
import { env } from "../config/env"
import { logger } from "../utils/logger"
import { importETenders } from "../modules/tenders/tender.service"

let isImportRunning = false

type ETendersStatus = 1 | 2 | 3 | 4

function parseStatuses(rawValue: string): ETendersStatus[] {
  const parsed = String(rawValue)
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value): value is ETendersStatus => [1, 2, 3, 4].includes(value))

  return parsed.length > 0 ? Array.from(new Set(parsed)) : [1, 2, 3, 4]
}

function describeStatus(status: ETendersStatus) {
  switch (status) {
    case 1:
      return "open"
    case 2:
      return "awarded"
    case 3:
      return "closed"
    case 4:
      return "cancelled"
  }
}

async function ensureImportUser() {
  return prisma.user.upsert({
    where: { email: env.ETENDERS_AUTO_IMPORT_USER_EMAIL },
    update: {
      isActive: true,
      name: "eTenders Import Bot",
    },
    create: {
      email: env.ETENDERS_AUTO_IMPORT_USER_EMAIL,
      name: "eTenders Import Bot",
      isActive: true,
      emailVerifiedAt: new Date(),
    },
    select: { id: true, email: true },
  })
}

async function runScheduledETendersImport() {
  if (isImportRunning) {
    logger.warn("Skipping scheduled eTenders import because another run is active")
    return
  }

  isImportRunning = true

  try {
    const actor = await ensureImportUser()
    const statuses = parseStatuses(env.ETENDERS_AUTO_IMPORT_STATUSES)

    logger.info(
      {
        statuses,
        limit: env.ETENDERS_AUTO_IMPORT_LIMIT,
        start: env.ETENDERS_AUTO_IMPORT_START,
        stopOnExisting: env.ETENDERS_AUTO_IMPORT_STOP_ON_EXISTING,
        recentWindowHours: env.ETENDERS_AUTO_IMPORT_WINDOW_HOURS,
        timezone: env.ETENDERS_AUTO_IMPORT_TIMEZONE,
        actor: actor.email,
      },
      "Starting scheduled eTenders import",
    )

    for (const status of statuses) {
      const startedAt = Date.now()
      const result = await importETenders({
        orgId: null,
        userId: actor.id,
        limit: env.ETENDERS_AUTO_IMPORT_LIMIT,
        start: env.ETENDERS_AUTO_IMPORT_START,
        status,
        stopOnExisting: env.ETENDERS_AUTO_IMPORT_STOP_ON_EXISTING,
        recentWindowHours: env.ETENDERS_AUTO_IMPORT_WINDOW_HOURS,
      })

      logger.info(
        {
          status,
          lifecycle: describeStatus(status),
          imported: result.totalImported,
          skipped: result.totalSkipped,
          stopTriggered: result.stopTriggered,
          elapsedMs: Date.now() - startedAt,
        },
        "Completed scheduled eTenders import batch",
      )
    }

    logger.info("Scheduled eTenders import finished")
  } catch (error) {
    logger.error({ err: error }, "Scheduled eTenders import failed")
  } finally {
    isImportRunning = false
  }
}

export function scheduleETendersImportJob() {
  if (!env.ETENDERS_AUTO_IMPORT_ENABLED) return

  cron.schedule(
    env.ETENDERS_AUTO_IMPORT_CRON,
    async () => {
      await runScheduledETendersImport()
    },
    {
      timezone: env.ETENDERS_AUTO_IMPORT_TIMEZONE,
    },
  )

  logger.info(
    {
      cron: env.ETENDERS_AUTO_IMPORT_CRON,
      timezone: env.ETENDERS_AUTO_IMPORT_TIMEZONE,
      statuses: parseStatuses(env.ETENDERS_AUTO_IMPORT_STATUSES),
      limit: env.ETENDERS_AUTO_IMPORT_LIMIT,
      stopOnExisting: env.ETENDERS_AUTO_IMPORT_STOP_ON_EXISTING,
      recentWindowHours: env.ETENDERS_AUTO_IMPORT_WINDOW_HOURS,
    },
    "Scheduled eTenders import job configured",
  )
}
