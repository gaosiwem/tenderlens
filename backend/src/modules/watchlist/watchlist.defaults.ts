import { Prisma } from "@prisma/client"
import { prisma } from "../../db/prisma"

export const DEFAULT_WATCHLIST_REMINDER_TYPES = [
  "CLOSING_24H",
  "CLOSING_2H",
] as const

export type DefaultWatchlistReminderType =
  | (typeof DEFAULT_WATCHLIST_REMINDER_TYPES)[number]
  | "BRIEFING_SESSION"

export function buildDefaultWatchlistReminderTypes(args?: {
  hasBriefingSession?: boolean | null
}): DefaultWatchlistReminderType[] {
  const types: DefaultWatchlistReminderType[] = [
    ...DEFAULT_WATCHLIST_REMINDER_TYPES,
  ]

  if (args?.hasBriefingSession) {
    types.push("BRIEFING_SESSION")
  }

  return types
}

export async function backfillBriefingReminderForTenderWatchers(tenderId: string) {
  return prisma.$executeRaw(Prisma.sql`
    UPDATE "WatchlistItem"
    SET "reminderTypes" = array_append("reminderTypes", 'BRIEFING_SESSION')
    WHERE "tenderId" = ${tenderId}
      AND NOT ('BRIEFING_SESSION' = ANY("reminderTypes"))
  `)
}
