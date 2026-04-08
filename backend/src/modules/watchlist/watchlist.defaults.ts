export const DEFAULT_WATCHLIST_REMINDER_TYPES = [
  "CLOSING_24H",
  "CLOSING_2H",
] as const

export type DefaultWatchlistReminderType =
  (typeof DEFAULT_WATCHLIST_REMINDER_TYPES)[number]

export function buildDefaultWatchlistReminderTypes(): DefaultWatchlistReminderType[] {
  return [...DEFAULT_WATCHLIST_REMINDER_TYPES]
}
