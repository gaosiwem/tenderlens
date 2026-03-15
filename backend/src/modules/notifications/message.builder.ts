import { env } from "../../config/env"

export type NotificationEventLike = {
  type?: string | null
  entityType?: string | null
  entityId?: string | null
  createdAt?: Date | string | null
  meta?: unknown
}

export type EmailMessageContent = {
  subject: string
  text: string
  html: string
}

const WATCHLIST_REMINDER_LABELS: Record<string, string> = {
  CLOSING_7D: "Closing in 7 days",
  CLOSING_24H: "Closing in 24 hours",
  CLOSING_2H: "Closing in 2 hours",
  BRIEFING_SESSION: "Briefing session in 24 hours",
  SITE_VISIT: "Site visit in 24 hours",
}

const TRIAL_TOUCH_LABELS: Record<string, string> = {
  WELCOME: "Welcome to your trial",
  DAY3: "Getting started tips",
  DAY10: "Trial progress check-in",
  EXPIRY_48H: "Trial expires soon",
  POST_EXPIRY_DAY1: "Your trial has ended",
  POST_EXPIRY_DAY7: "Last reminder to reactivate",
}

type BrandTheme = {
  name: string
  logoUrl: string | null
  bg: string
  card: string
  text: string
  muted: string
  accent: string
  border: string
  footerText: string
}

type WatchlistBatchMetaItem = {
  tenderId: string
  tenderTitle: string | null
  companyName: string | null
  closingDate: string | null
  reminderType: string | null
}

function toMetaObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function readString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key]
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readNumber(meta: Record<string, unknown>, key: string): number | null {
  const value = meta[key]
  if (typeof value === "number" && Number.isFinite(value)) return value
  return null
}

function readWatchlistBatchItems(
  meta: Record<string, unknown>,
): WatchlistBatchMetaItem[] {
  const raw = meta.items
  if (!Array.isArray(raw)) return []

  const out: WatchlistBatchMetaItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const obj = item as Record<string, unknown>
    const tenderId = typeof obj.tenderId === "string" ? obj.tenderId : null
    if (!tenderId) continue

    out.push({
      tenderId,
      tenderTitle: typeof obj.tenderTitle === "string" ? obj.tenderTitle : null,
      companyName: typeof obj.companyName === "string" ? obj.companyName : null,
      closingDate: typeof obj.closingDate === "string" ? obj.closingDate : null,
      reminderType: typeof obj.reminderType === "string" ? obj.reminderType : null,
    })
  }

  return out
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function toHumanDate(value: Date | string | null | undefined): string | null {
  const iso = toIsoString(value)
  if (!iso) return null

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso))
}

function prettifyToken(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function normalizeColor(value: string, fallback: string) {
  const v = String(value || "").trim()
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v) ? v : fallback
}

function resolveBrandTheme(): BrandTheme {
  return {
    name: env.EMAIL_BRAND_NAME?.trim() || "TenderLens",
    logoUrl: env.EMAIL_BRAND_LOGO_URL?.trim() || null,
    bg: normalizeColor(env.EMAIL_BRAND_BACKGROUND_COLOR, "#f5f7fb"),
    card: normalizeColor(env.EMAIL_BRAND_CARD_COLOR, "#ffffff"),
    text: normalizeColor(env.EMAIL_BRAND_TEXT_COLOR, "#111827"),
    muted: normalizeColor(env.EMAIL_BRAND_MUTED_COLOR, "#6b7280"),
    accent: normalizeColor(env.EMAIL_BRAND_PRIMARY_COLOR, "#0f766e"),
    border: normalizeColor(env.EMAIL_BRAND_BORDER_COLOR, "#e5e7eb"),
    footerText:
      env.EMAIL_BRAND_FOOTER_TEXT?.trim() ||
      "This message was sent by TenderLens notifications.",
  }
}

function resolveCtaUrl(event: NotificationEventLike) {
  const meta = toMetaObject(event.meta)
  const kind = readString(meta, "kind")
  if (kind === "WATCHLIST_BATCH_SUMMARY") {
    return `${env.FRONTEND_URL}/watchlist`
  }

  if (event.entityType === "Tender" && event.entityId) {
    return `${env.FRONTEND_URL}/tenders/${event.entityId}`
  }

  if (event.entityType === "BidTask" && event.entityId) {
    return `${env.FRONTEND_URL}/admin/notifications`
  }

  if (event.entityType === "OrgSubscription") {
    return `${env.FRONTEND_URL}/billing`
  }

  return `${env.FRONTEND_URL}/admin/notifications`
}

export type BrandedEmailLayoutArgs = {
  title: string
  subtitle: string
  details: Array<{ label: string; value: string }>
  ctaLabel: string
  ctaUrl: string
}

export function buildBrandedEmailLayout(args: BrandedEmailLayoutArgs) {
  const theme = resolveBrandTheme()
  const detailsText =
    args.details.length > 0
      ? args.details.map((d) => `${d.label}: ${d.value}`).join("\n")
      : "Open your TenderLens dashboard for full details."

  const text = [
    args.title,
    args.subtitle,
    "",
    detailsText,
    "",
    `Open: ${args.ctaUrl}`,
    "",
    theme.name,
  ].join("\n")

  const detailRows = args.details
    .map(
      (d) =>
        `<tr>
          <td style="padding:8px 0;color:${theme.muted};font-size:13px;width:140px;">${escapeHtml(d.label)}</td>
          <td style="padding:8px 0;color:${theme.text};font-size:13px;font-weight:600;">${escapeHtml(d.value)}</td>
        </tr>`,
    )
    .join("")

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:${theme.bg};font-family:Arial,Helvetica,sans-serif;color:${theme.text};">
    <div style="max-width:640px;margin:24px auto;padding:0 12px;">
      <div style="background:${theme.card};border:1px solid ${theme.border};border-radius:12px;overflow:hidden;">
        <div style="padding:20px 24px;border-bottom:1px solid ${theme.border};">
          <div style="display:flex;align-items:center;gap:10px;">
            ${
              theme.logoUrl
                ? `<img src="${escapeHtml(theme.logoUrl)}" alt="${escapeHtml(theme.name)} logo" style="height:28px;max-width:140px;object-fit:contain;" />`
                : ""
            }
            <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:${theme.accent};text-transform:uppercase;">${escapeHtml(theme.name)}</div>
          </div>
          <h1 style="margin:8px 0 6px;font-size:22px;line-height:1.3;">${escapeHtml(args.title)}</h1>
          <p style="margin:0;color:${theme.muted};font-size:14px;line-height:1.5;">${escapeHtml(args.subtitle)}</p>
        </div>
        <div style="padding:20px 24px;">
          <table style="width:100%;border-collapse:collapse;">${detailRows}</table>
          <div style="margin-top:20px;">
            <a href="${escapeHtml(args.ctaUrl)}" style="display:inline-block;background:${theme.accent};color:#ffffff;text-decoration:none;padding:11px 16px;border-radius:8px;font-size:14px;font-weight:700;">
              ${escapeHtml(args.ctaLabel)}
            </a>
          </div>
        </div>
      </div>
      <p style="margin:12px 4px 0;color:${theme.muted};font-size:12px;">
        ${escapeHtml(theme.footerText)}
      </p>
    </div>
  </body>
</html>`

  return { text, html }
}

function buildWatchlistBatchDetails(meta: Record<string, unknown>) {
  const details: Array<{ label: string; value: string }> = []
  const totalItems = readNumber(meta, "totalItems")
  const overflowCount = readNumber(meta, "overflowCount")
  const windowStart = toHumanDate(readString(meta, "windowStart"))
  const windowEnd = toHumanDate(readString(meta, "windowEnd"))
  const items = readWatchlistBatchItems(meta)

  details.push({
    label: "Total tenders",
    value: String(totalItems ?? items.length),
  })

  if (windowStart && windowEnd) {
    details.push({ label: "Window", value: `${windowStart} to ${windowEnd}` })
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    const label = `Tender ${i + 1}`
    const parts: string[] = []
    if (item.tenderTitle) parts.push(item.tenderTitle)
    if (item.companyName) parts.push(item.companyName)
    if (item.reminderType) {
      parts.push(
        WATCHLIST_REMINDER_LABELS[item.reminderType] ??
          prettifyToken(item.reminderType),
      )
    }
    const closing = toHumanDate(item.closingDate)
    if (closing) parts.push(`Closes ${closing}`)

    details.push({
      label,
      value: parts.length > 0 ? parts.join(" | ") : item.tenderId,
    })
  }

  if (overflowCount && overflowCount > 0) {
    details.push({
      label: "More",
      value: `+${overflowCount} additional tenders`,
    })
  }

  return details
}

function buildDetails(meta: Record<string, unknown>, kind: string | null) {
  if (kind === "WATCHLIST_BATCH_SUMMARY") {
    return buildWatchlistBatchDetails(meta)
  }

  const details: Array<{ label: string; value: string }> = []

  const reminderType = readString(meta, "reminderType")
  const tenderTitle = readString(meta, "tenderTitle")
  const companyName = readString(meta, "companyName")
  const closingDate = toHumanDate(readString(meta, "closingDate"))
  const dueAt = toHumanDate(readString(meta, "dueAt"))
  const warningKind = readString(meta, "warningKind")
  const touch = readString(meta, "touch")
  const segment = readString(meta, "segment")

  if (reminderType) {
    details.push({
      label: "Reminder",
      value: WATCHLIST_REMINDER_LABELS[reminderType] ?? prettifyToken(reminderType),
    })
  }
  if (warningKind) details.push({ label: "Warning", value: prettifyToken(warningKind) })
  if (touch) details.push({ label: "Campaign", value: TRIAL_TOUCH_LABELS[touch] ?? prettifyToken(touch) })
  if (segment) details.push({ label: "Segment", value: prettifyToken(segment) })
  if (tenderTitle) details.push({ label: "Tender", value: tenderTitle })
  if (companyName) details.push({ label: "Company", value: companyName })
  if (closingDate) details.push({ label: "Closing", value: closingDate })
  if (dueAt) details.push({ label: "Due", value: dueAt })

  const used = readNumber(meta, "used")
  const limit = readNumber(meta, "limit")
  if (used !== null) details.push({ label: "Used", value: String(used) })
  if (limit !== null) details.push({ label: "Limit", value: String(limit) })

  const purchased = readNumber(meta, "purchased")
  if (purchased !== null) details.push({ label: "Purchased", value: String(purchased) })

  const eventsCount = readNumber(meta, "eventsCount")
  if (eventsCount !== null) {
    details.push({ label: "Weekly events", value: String(eventsCount) })
  }

  return details
}

function buildSubject(kind: string | null, eventType: string, meta: Record<string, unknown>) {
  if (kind === "WATCHLIST_BATCH_SUMMARY") {
    const totalItems = readNumber(meta, "totalItems") ?? readWatchlistBatchItems(meta).length
    const suffix = totalItems === 1 ? "tender" : "tenders"
    return `TenderLens watchlist updates: ${totalItems} ${suffix}`
  }
  if (kind === "WATCHLIST_REMINDER") {
    const reminderType = readString(meta, "reminderType")
    const label =
      (reminderType && WATCHLIST_REMINDER_LABELS[reminderType]) || "Watchlist update"
    return `TenderLens watchlist reminder: ${label}`
  }
  if (kind === "DEADLINE_REMINDER") return "TenderLens deadline reminder"
  if (kind === "TASK_DUE_SOON") return "TenderLens task due soon"
  if (kind === "TASK_OVERDUE") return "TenderLens task overdue"
  if (kind === "TASK_ASSIGNED") return "TenderLens task assignment"
  if (kind === "MENTION") return "TenderLens mention"
  if (kind === "ENTITLEMENT_WARNING") return "TenderLens usage warning"
  if (kind === "TRIAL_CAMPAIGN") return "TenderLens trial update"
  if (kind === "WEEKLY_VALUE_SUMMARY") return "TenderLens weekly value summary"
  if (kind && kind.startsWith("RETENTION_")) return "TenderLens account update"
  return `TenderLens alert: ${eventType}`
}

function buildSubtitle(
  kind: string | null,
  eventType: string,
  eventTime: string,
  meta: Record<string, unknown>,
) {
  if (kind === "WATCHLIST_BATCH_SUMMARY") {
    const totalItems = readNumber(meta, "totalItems")
    const count = totalItems ?? readWatchlistBatchItems(meta).length
    const suffix = count === 1 ? "tender reminder" : "tender reminders"
    return `You have ${count} watchlist ${suffix} to review.`
  }

  const time = toHumanDate(eventTime) ?? eventTime
  const title = kind ? prettifyToken(kind) : prettifyToken(eventType)
  return `${title} triggered at ${time}.`
}

function buildTitle(kind: string | null, eventType: string) {
  if (kind === "WATCHLIST_BATCH_SUMMARY") return "Watchlist updates"
  return kind ? prettifyToken(kind) : prettifyToken(eventType)
}

export function buildNotificationContent(event: NotificationEventLike | null): EmailMessageContent {
  const eventType = event?.type || "Event"
  const eventTime = toIsoString(event?.createdAt ?? null) || new Date().toISOString()
  const meta = toMetaObject(event?.meta)
  const kind = readString(meta, "kind")
  const subject = buildSubject(kind, eventType, meta)
  const title = buildTitle(kind, eventType)
  const subtitle = buildSubtitle(kind, eventType, eventTime, meta)
  const details = buildDetails(meta, kind)
  const ctaUrl = resolveCtaUrl(event ?? {})
  const { text, html } = buildBrandedEmailLayout({
    title,
    subtitle,
    details,
    ctaLabel: "Open TenderLens",
    ctaUrl,
  })

  return { subject, text, html }
}

export function buildDailyDigestContent(args: {
  events: Array<NotificationEventLike>
  generatedAt?: Date
}): EmailMessageContent {
  const generatedAt = args.generatedAt ?? new Date()
  const typeCount = new Map<string, number>()
  for (const event of args.events) {
    const t = event.type || "UNKNOWN"
    typeCount.set(t, (typeCount.get(t) ?? 0) + 1)
  }

  const topTypes = Array.from(typeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const details: Array<{ label: string; value: string }> = [
    { label: "Generated", value: toHumanDate(generatedAt) ?? generatedAt.toISOString() },
    { label: "Events in digest", value: String(args.events.length) },
  ]

  for (const [eventType, count] of topTypes) {
    details.push({ label: prettifyToken(eventType), value: `${count}` })
  }

  const { text, html } = buildBrandedEmailLayout({
    title: "Daily digest",
    subtitle: "A summary of recent activity in your organization.",
    details,
    ctaLabel: "View Notifications",
    ctaUrl: `${env.FRONTEND_URL}/admin/notifications`,
  })

  return {
    subject: "TenderLens daily digest",
    text,
    html,
  }
}
