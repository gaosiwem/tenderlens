import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"
import {
  Prisma,
  TenderStatus,
  JobType,
  JobStatus,
  NotificationType,
} from "@prisma/client"
import { ORG_PROFILE_TENDER_SOURCE } from "../orgDocs/orgDocs.constants"
import crypto from "crypto"
import { logTenderChange } from "./changeLog.service"
import { emitEvent } from "../notifications/notifications.service"
import { storage } from "../storage/storage"
import { sha256 } from "../../utils/hash"

const ETENDERS_DEFAULT_URL =
  "https://www.etenders.gov.za/Home/PaginatedTenderOpportunities?draw=2&columns%5B0%5D%5Bdata%5D=&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=false&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=category&columns%5B1%5D%5Bname%5D=&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=true&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=description&columns%5B2%5D%5Bname%5D=&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=false&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=eSubmission&columns%5B3%5D%5Bname%5D=&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=true&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=date_Published&columns%5B4%5D%5Bname%5D=&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=true&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B5%5D%5Bdata%5D=closing_Date&columns%5B5%5D%5Bname%5D=&columns%5B5%5D%5Bsearchable%5D=true&columns%5B5%5D%5Borderable%5D=true&columns%5B5%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B5%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B6%5D%5Bdata%5D=actions&columns%5B6%5D%5Bname%5D=&columns%5B6%5D%5Bsearchable%5D=true&columns%5B6%5D%5Borderable%5D=true&columns%5B6%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B6%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=2&order%5B0%5D%5Bdir%5D=desc&start=0&length=1000&search%5Bvalue%5D=&search%5Bregex%5D=false&status=1&_=1745490004518"

type ETenderRow = {
  id: number
  tender_No: string | null
  tender_Type?: string | null
  tenderType?: string | null
  eSubmission?: boolean | string | null
  description: string | null
  category: string | null
  organ_of_State: string | null
  status: string | null
  province: string | null
  closing_Date: string | null
  cancelled_Date?: string | null
  canceled_Date?: string | null
  date_Published: string | null
  tenderAmount?: string | null
  briefingSession?: boolean | null
  briefingCompulsory?: boolean | null
  compulsory_briefing_session?: string | null
  briefingVenue?: string | null
  bidders?: string | null
  company?: Array<{
    company?: string | null
    tenderAmount?: string | null
  }> | null
  awards?: Array<{
    company?: string | null
    tenderAmount?: string | null
  }> | null
  supportDocument?: Array<{
    supportDocumentID: string
    fileName: string
    extension?: string
  }>
}

type ETendersPayload = {
  data?: ETenderRow[]
  recordsTotal?: number
  recordsFiltered?: number
}

export type ExternalTenderDocument = {
  id: string
  name: string
  path: string
}

export type ImportETendersProgress = {
  source: string
  requested: number
  status: number
  processed: number
  imported: number
  skipped: number
  currentStart: number
  batchSize: number
  stopTriggered: boolean
  elapsedMs: number
}

export type ScrapedTenderData = {
  source: string | null
  externalId: number | null
  available: boolean
  tenderNumber: string | null
  tenderType: string | null
  eSubmission: boolean | null
  description: string | null
  category: string | null
  companyName: string | null
  province: string | null
  status: string | null
  publishedDate: string | null
  closingDate: string | null
  amount: string | null
  briefingSession: boolean | null
  briefingCompulsory: boolean | null
  briefingDateTime: string | null
  briefingVenue: string | null
}

export type TenderLifecycle = "open" | "awarded" | "closed" | "cancelled"
export type TenderLifecycleDateSource =
  | "closing_date"
  | "cancelled_date"
  | "import_detected_at"
  | "unknown"

export type OutcomeInsightAction = {
  kind:
    | "watch_tender"
    | "track_reissue"
    | "review_timeline"
    | "open_compare"
    | "open_workspace"
  label: string
  href: string
  description: string
}

export type OutcomeInsightRelatedTender = {
  id: string
  title: string
  companyName: string | null
  closingDate: string | null
  amount: string | null
  lifecycle: TenderLifecycle
  reason: string
}

export type TenderOutcomeInsights = {
  tenderId: string
  generationMode: "rules"
  lifecycle: TenderLifecycle
  lifecycleDetectedAt: string | null
  lifecycleDate: string | null
  lifecycleDateSource: TenderLifecycleDateSource
  lifecycleDateLabel: string
  statusLabel: string
  summary: string
  staleDays: number | null
  watched: boolean
  recommendedActions: OutcomeInsightAction[]
  similarTenders: OutcomeInsightRelatedTender[]
  reissueCandidates: OutcomeInsightRelatedTender[]
  stats: {
    buyerTenderCount: number
    buyerAwardedCount: number
    buyerCancelledCount: number
    categoryTenderCount: number
  }
}

type PersistedExternalTenderDocument = {
  id: string
  name: string
  path: string
  archivedStorageKey: string | null
  archivedMimeType: string | null
  archivedSizeBytes: number | null
  archivedChecksumSha256: string | null
  archivedAt: string | null
}

type ListTenderRow = {
  id: string
  orgId: string | null
  title: string
  source: string | null
  status: TenderStatus
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  deadlineClosingAt: Date | null
  tenderClosingDate: string | null
  lifecycle: string | null
  lifecycleDetectedAt: Date | null
  lifecycleDateSource: string | null
  companyName: string | null
  category: string | null
  province: string | null
  tenderNumber: string | null
  tenderType: string | null
  eSubmission: boolean | null
  scrapedStatus: string | null
  amount: string | null
}

type TenderScrapedSnapshotRow = {
  source: string | null
  externalId: number | null
  available: boolean
  tenderNumber: string | null
  tenderType: string | null
  eSubmission: boolean | null
  description: string | null
  category: string | null
  companyName: string | null
  province: string | null
  scrapedStatus: string | null
  publishedDate: string | null
  closingDate: string | null
  amount: string | null
  briefingSession: boolean | null
  briefingCompulsory: boolean | null
  briefingDateTime: string | null
  briefingVenue: string | null
  documents?: unknown
}

type TenderLifecycleSnapshotRow = {
  lifecycle: string | null
  lifecycleDetectedAt: Date | null
  lifecycleDateSource: string | null
}

type LegacyTableName = "TenderScrapedData" | "ScrapedTenderData"

const ETENDERS_RECREATED_FILE_TAG = /\s\[etenders:[^\]]+\]\s*$/i
const GENERATED_FILE_MARKER = /\(generated\)/i
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ETENDERS_FEED_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  min = 1,
  max = Number.POSITIVE_INFINITY,
) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.floor(parsed)
  if (rounded < min || rounded > max) return fallback
  return rounded
}

const ETENDERS_FEED_FETCH_ATTEMPTS = parsePositiveInt(
  process.env.ETENDERS_FEED_FETCH_ATTEMPTS,
  6,
  1,
  12,
)
const ETENDERS_FEED_FETCH_TIMEOUT_MS = parsePositiveInt(
  process.env.ETENDERS_FEED_FETCH_TIMEOUT_MS,
  45000,
  5000,
  180000,
)
const ETENDERS_FEED_RETRY_BASE_DELAY_MS = parsePositiveInt(
  process.env.ETENDERS_FEED_RETRY_BASE_DELAY_MS,
  1500,
  100,
  30000,
)
const ETENDERS_IMPORT_BATCH_SIZE = parsePositiveInt(
  process.env.ETENDERS_IMPORT_BATCH_SIZE,
  100,
  1,
  500,
)
const ETENDERS_IMPORT_CANCELLED_BATCH_SIZE = parsePositiveInt(
  process.env.ETENDERS_IMPORT_CANCELLED_BATCH_SIZE,
  25,
  1,
  250,
)
const EXTERNAL_TENDER_ARCHIVE_FETCH_TIMEOUT_MS = parsePositiveInt(
  process.env.EXTERNAL_TENDER_ARCHIVE_FETCH_TIMEOUT_MS,
  15000,
  3000,
  120000,
)
const EXTERNAL_TENDER_ARCHIVE_MAX_BYTES = parsePositiveInt(
  process.env.EXTERNAL_TENDER_ARCHIVE_MAX_BYTES,
  52428800,
  1024,
  262144000,
)

const EXTERNAL_TENDER_ARCHIVABLE_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
])

function isHiddenTenderFileForUser(filename: string) {
  const name = (filename ?? "").trim()
  if (!name) return false
  if (ETENDERS_RECREATED_FILE_TAG.test(name)) return true
  if (GENERATED_FILE_MARKER.test(name)) return true
  return false
}

function hasFileExtension(name: string) {
  const lastSlash = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"))
  const base = lastSlash >= 0 ? name.slice(lastSlash + 1) : name
  const dot = base.lastIndexOf(".")
  return dot > 0 && dot < base.length - 1
}

function looksLikeOpaqueId(name: string) {
  const t = (name ?? "").trim()
  if (!t) return false
  const noExt = t.replace(/\.[A-Za-z0-9]{1,6}$/, "")
  return UUID_RE.test(noExt) || /^[0-9a-f]{24,}$/i.test(noExt)
}

function extensionFromMimeType(mimeType: string | null | undefined) {
  const m = (mimeType ?? "").trim().toLowerCase()
  if (m === "application/pdf") return ".pdf"
  if (m === "text/plain") return ".txt"
  if (
    m ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return ".docx"
  }
  return ""
}

function filenameFromStorageKey(storageKey: string | null | undefined) {
  const key = (storageKey ?? "").trim()
  if (!key) return ""
  const raw = key.split("/").pop() ?? ""
  if (!raw) return ""
  return raw.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    "",
  )
}

function decodeDownloadedFileNameFromPath(pathValue: string) {
  try {
    const url = new URL(pathValue)
    return (url.searchParams.get("downloadedFileName") ?? "").trim()
  } catch {
    return ""
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function mimeFromFilename(name: string) {
  const lower = name.toLowerCase().trim()
  if (lower.endsWith(".pdf")) return "application/pdf"
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
  if (lower.endsWith(".txt")) return "text/plain"
  return ""
}

function pickExternalDocumentMimeType(
  contentType: string | null | undefined,
  fileName: string,
) {
  const ctype = (contentType ?? "").split(";")[0]?.trim().toLowerCase()
  if (ctype && EXTERNAL_TENDER_ARCHIVABLE_MIME_TYPES.has(ctype)) return ctype
  return mimeFromFilename(fileName)
}

function looksLikeHtmlDocument(buf: Buffer) {
  const head = buf.slice(0, 1024).toString("utf-8").toLowerCase()
  return (
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("<head") ||
    head.includes("<body")
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

function isRetriableETendersFetchError(error: unknown) {
  if (!error || typeof error !== "object") return false

  const candidate = error as {
    name?: string
    code?: string
    cause?: {
      code?: string
      name?: string
    }
  }

  if (candidate.name === "TimeoutError") return true

  const code = candidate.code ?? candidate.cause?.code ?? ""
  if (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN"
  ) {
    return true
  }

  return false
}

function normalizeExternalDocumentName(args: {
  id: string
  name: string
  path: string
}) {
  const direct = (args.name ?? "").trim()
  const fromPath = decodeDownloadedFileNameFromPath(args.path)

  if (direct && !looksLikeOpaqueId(direct)) return direct
  if (fromPath && !looksLikeOpaqueId(fromPath)) return fromPath
  if (direct) return direct
  return `External document ${args.id}`
}

export function deriveDisplayFilename(args: {
  originalFilename: string
  storageKey?: string | null
  mimeType?: string | null
}) {
  const direct = (args.originalFilename ?? "").trim()
  const fromStorage = filenameFromStorageKey(args.storageKey)

  let candidate = direct
  if (!candidate || looksLikeOpaqueId(candidate)) {
    if (fromStorage && !looksLikeOpaqueId(fromStorage)) {
      candidate = fromStorage
    }
  }
  if (!candidate) candidate = fromStorage || "document"

  if (!hasFileExtension(candidate)) {
    const ext = extensionFromMimeType(args.mimeType)
    if (ext) candidate = `${candidate}${ext}`
  }

  return candidate
}

function buildArchivedExternalDocumentDownloadPath(args: {
  tenderId: string
  documentId: string
}) {
  return `/api/v1/tenders/${encodeURIComponent(args.tenderId)}/external-documents/${encodeURIComponent(args.documentId)}/download`
}

function emptyScrapedData(input?: {
  source?: string | null
  externalId?: number | null
}): ScrapedTenderData {
  return {
    source: input?.source ?? null,
    externalId: input?.externalId ?? null,
    available: false,
    tenderNumber: null,
    tenderType: null,
    eSubmission: null,
    description: null,
    category: null,
    companyName: null,
    province: null,
    status: null,
    publishedDate: null,
    closingDate: null,
    amount: null,
    briefingSession: null,
    briefingCompulsory: null,
    briefingDateTime: null,
    briefingVenue: null,
  }
}

function inferScrapedSource(rawSource: string | null) {
  if (!rawSource) return null
  if (/^etenders:/i.test(rawSource.trim())) return "etenders.gov.za"
  return rawSource
}

function parseDateLike(value: string | null | undefined) {
  const input = (value ?? "").trim()
  if (!input) return null
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function toIsoStringOrNull(value: Date | null | undefined) {
  if (!value) return null
  return value.toISOString()
}

function normalizeLifecycleDateSource(
  value: string | null | undefined,
): TenderLifecycleDateSource {
  switch ((value ?? "").trim().toLowerCase()) {
    case "closing_date":
      return "closing_date"
    case "cancelled_date":
      return "cancelled_date"
    case "import_detected_at":
      return "import_detected_at"
    default:
      return "unknown"
  }
}

export function inferTenderLifecycle(args: {
  scrapedStatus?: string | null
  closingDate?: string | null
}): TenderLifecycle {
  const status = (args.scrapedStatus ?? "").trim().toLowerCase()
  if (status.includes("award")) return "awarded"
  if (status.includes("cancel")) return "cancelled"
  if (status.includes("closed")) return "closed"
  if (status.includes("publish") || status.includes("open")) return "open"

  const closingAt = parseDateLike(args.closingDate)
  if (closingAt && closingAt.getTime() < Date.now()) return "closed"
  return "open"
}

function inferLifecycleDateLabel(
  lifecycle: TenderLifecycle,
  source: TenderLifecycleDateSource,
) {
  if (lifecycle === "awarded") {
    return source === "import_detected_at" ? "Award Status Detected" : "Award Date"
  }
  if (lifecycle === "cancelled") {
    return source === "cancelled_date" ? "Cancelled Date" : "Relevant Date"
  }
  if (lifecycle === "closed") return "Closing Date"
  return "Relevant Date"
}

function inferLifecycleDateInfo(args: {
  lifecycle: TenderLifecycle
  closingDate?: string | null
  lifecycleDetectedAt?: Date | null
  lifecycleDateSource?: string | null
}): {
  date: Date | null
  source: TenderLifecycleDateSource
} {
  const persistedSource = normalizeLifecycleDateSource(args.lifecycleDateSource)
  if (args.lifecycle === "awarded") {
    return {
      date: args.lifecycleDetectedAt ?? null,
      source: args.lifecycleDetectedAt ? persistedSource : "unknown",
    }
  }

  const closingAt = parseDateLike(args.closingDate)
  if (
    args.lifecycle === "cancelled" &&
    persistedSource === "cancelled_date" &&
    args.lifecycleDetectedAt
  ) {
    return {
      date: args.lifecycleDetectedAt,
      source: "cancelled_date",
    }
  }

  if (closingAt) {
    return {
      date: closingAt,
      source:
        persistedSource === "unknown" ? "closing_date" : persistedSource,
    }
  }

  if (args.lifecycleDetectedAt) {
    return {
      date: args.lifecycleDetectedAt,
      source:
        persistedSource === "unknown" ? "import_detected_at" : persistedSource,
    }
  }

  return { date: null, source: persistedSource }
}

function describeLifecycle(lifecycle: TenderLifecycle) {
  switch (lifecycle) {
    case "awarded":
      return "Awarded"
    case "cancelled":
      return "Cancelled"
    case "closed":
      return "Closed"
    default:
      return "Open"
  }
}

function titleKeywordSet(title: string) {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((item) => item.trim())
      .filter((item) => item.length >= 4),
  )
}

function hasTitleOverlap(a: string, b: string) {
  const left = titleKeywordSet(a)
  const right = titleKeywordSet(b)
  if (left.size === 0 || right.size === 0) return false
  for (const item of left) {
    if (right.has(item)) return true
  }
  return false
}

function accessibleTenderWhere(orgId: string): Prisma.TenderWhereInput {
  void orgId
  return {
    orgId: null,
    source: { not: ORG_PROFILE_TENDER_SOURCE },
  }
}

let legacyScrapedTableNamePromise: Promise<LegacyTableName | null> | null = null
let tenderScrapedColumnsAvailablePromise: Promise<boolean> | null = null
let tenderLifecycleColumnsAvailablePromise: Promise<boolean> | null = null

async function hasTenderScrapedColumns() {
  if (!tenderScrapedColumnsAvailablePromise) {
    tenderScrapedColumnsAvailablePromise = prisma
      .$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'Tender'
            AND column_name IN ('externalId', 'scrapedStatus', 'documents')
          GROUP BY table_name
          HAVING COUNT(*) >= 3
        ) AS "exists"
      `)
      .then((rows) => Boolean(rows[0]?.exists))
      .catch(() => false)
  }

  return tenderScrapedColumnsAvailablePromise
}

async function hasTenderLifecycleColumns() {
  if (!tenderLifecycleColumnsAvailablePromise) {
    tenderLifecycleColumnsAvailablePromise = prisma
      .$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'Tender'
            AND column_name IN ('lifecycle', 'lifecycleDetectedAt', 'lifecycleDateSource')
          GROUP BY table_name
          HAVING COUNT(*) >= 3
        ) AS "exists"
      `)
      .then((rows) => Boolean(rows[0]?.exists))
      .catch(() => false)
  }

  return tenderLifecycleColumnsAvailablePromise
}

function isMissingTenderScrapedColumnsError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2010" &&
    (error.meta as { code?: string } | undefined)?.code === "42703"
  ) {
    return true
  }

  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : ""

  return (
    message.includes("closingDate") ||
    message.includes("companyName") ||
    message.includes("externalId") ||
    message.includes("scrapedStatus") ||
    message.includes("tenderNumber") ||
    message.includes("tenderType") ||
    message.includes("eSubmission") ||
    message.includes("publishedDate") ||
    message.includes("lastScrapedAt") ||
    message.includes("documents") ||
    message.includes("lifecycle") ||
    message.includes("lifecycleDetectedAt") ||
    message.includes("lifecycleDateSource") ||
    message.includes("briefingSession") ||
    message.includes("briefingCompulsory") ||
    message.includes("briefingDateTime") ||
    message.includes("briefingVenue") ||
    message.includes('column "externalId"') ||
    message.includes('column "available"') ||
    message.includes('column "tenderNumber"') ||
    message.includes('column "tenderType"') ||
    message.includes('column "eSubmission"') ||
    message.includes('column "description"') ||
    message.includes('column "category"') ||
    message.includes('column "companyName"') ||
    message.includes('column "province"') ||
    message.includes('column "scrapedStatus"') ||
    message.includes('column "publishedDate"') ||
    message.includes('column "closingDate"') ||
    message.includes('column "amount"') ||
    message.includes('column "documents"') ||
    message.includes('column "lastScrapedAt"') ||
    message.includes('column "lifecycle"') ||
    message.includes('column "lifecycleDetectedAt"') ||
    message.includes('column "lifecycleDateSource"')
    || message.includes('column "briefingSession"')
    || message.includes('column "briefingCompulsory"')
    || message.includes('column "briefingDateTime"')
    || message.includes('column "briefingVenue"')
  )
}

async function getLegacyScrapedTableName(): Promise<LegacyTableName | null> {
  if (!legacyScrapedTableNamePromise) {
    legacyScrapedTableNamePromise = prisma
      .$queryRaw<Array<{ table_name: string }>>(
        Prisma.sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('TenderScrapedData', 'ScrapedTenderData')
        ORDER BY CASE WHEN table_name = 'TenderScrapedData' THEN 0 ELSE 1 END
        LIMIT 1
      `,
      )
      .then((rows) => {
        const name = rows[0]?.table_name
        if (name === "TenderScrapedData" || name === "ScrapedTenderData") {
          return name
        }
        return null
      })
      .catch(() => null)
  }

  return legacyScrapedTableNamePromise
}

async function loadLegacyScrapedSnapshot(
  tenderId: string,
): Promise<TenderScrapedSnapshotRow | null> {
  const table = await getLegacyScrapedTableName()
  if (!table) return null

  try {
    const tableRef = Prisma.raw(`"${table}"`)
    const rows = await prisma.$queryRaw<TenderScrapedSnapshotRow[]>(Prisma.sql`
      SELECT
        "source",
        "externalId",
        "available",
        "tenderNumber",
        NULL::text AS "tenderType",
        NULL::boolean AS "eSubmission",
        "description",
        "category",
        "companyName",
        "province",
        "status" AS "scrapedStatus",
        "publishedDate",
        "closingDate",
        NULL::text AS "amount",
        NULL::boolean AS "briefingSession",
        NULL::boolean AS "briefingCompulsory",
        NULL::text AS "briefingDateTime",
        NULL::text AS "briefingVenue",
        "documents"
      FROM ${tableRef}
      WHERE "tenderId" = ${tenderId}
      LIMIT 1
    `)

    return rows[0] ?? null
  } catch {
    return null
  }
}

async function loadTenderScrapedSnapshot(
  tenderId: string,
): Promise<TenderScrapedSnapshotRow | null> {
  try {
    const rows = await prisma.$queryRaw<TenderScrapedSnapshotRow[]>(Prisma.sql`
      SELECT
        "source",
        "externalId",
        "available",
        "tenderNumber",
        "tenderType",
        "eSubmission",
        "description",
        "category",
        "companyName",
        "province",
        "scrapedStatus",
        "publishedDate",
        "closingDate",
        "amount",
        "briefingSession",
        "briefingCompulsory",
        "briefingDateTime",
        "briefingVenue",
        "documents"
      FROM "Tender"
      WHERE "id" = ${tenderId}
      LIMIT 1
    `)
    return rows[0] ?? null
  } catch (error) {
    if (!isMissingTenderScrapedColumnsError(error)) throw error
    return loadLegacyScrapedSnapshot(tenderId)
  }
}

async function loadTenderLifecycleSnapshot(
  tenderId: string,
): Promise<TenderLifecycleSnapshotRow | null> {
  if (!(await hasTenderLifecycleColumns())) return null

  try {
    const rows = await prisma.$queryRaw<TenderLifecycleSnapshotRow[]>(Prisma.sql`
      SELECT
        "lifecycle",
        "lifecycleDetectedAt",
        "lifecycleDateSource"
      FROM "Tender"
      WHERE "id" = ${tenderId}
      LIMIT 1
    `)
    return rows[0] ?? null
  } catch (error) {
    if (!isMissingTenderScrapedColumnsError(error)) throw error
    return null
  }
}

async function loadTenderLifecycleState(
  tenderId: string,
): Promise<{
  scraped: TenderScrapedSnapshotRow | null
  lifecycle: TenderLifecycle
  lifecycleDetectedAt: Date | null
  lifecycleDateSource: TenderLifecycleDateSource
  lifecycleDate: Date | null
}> {
  const [scraped, lifecycle] = await Promise.all([
    loadTenderScrapedSnapshot(tenderId),
    loadTenderLifecycleSnapshot(tenderId),
  ])

  const inferredLifecycle = inferTenderLifecycle({
    scrapedStatus: scraped?.scrapedStatus,
    closingDate: scraped?.closingDate,
  })
  const persistedLifecycle = String(lifecycle?.lifecycle ?? "")
    .trim()
    .toLowerCase()
  const lifecycleValue: TenderLifecycle =
    persistedLifecycle === "awarded" ||
    persistedLifecycle === "closed" ||
    persistedLifecycle === "cancelled" ||
    persistedLifecycle === "open"
      ? (persistedLifecycle as TenderLifecycle)
      : inferredLifecycle
  const lifecycleInfo = inferLifecycleDateInfo({
    lifecycle: lifecycleValue,
    closingDate: scraped?.closingDate,
    lifecycleDetectedAt: lifecycle?.lifecycleDetectedAt ?? null,
    lifecycleDateSource: lifecycle?.lifecycleDateSource ?? null,
  })

  return {
    scraped,
    lifecycle: lifecycleValue,
    lifecycleDetectedAt: lifecycle?.lifecycleDetectedAt ?? null,
    lifecycleDateSource: lifecycleInfo.source,
    lifecycleDate: lifecycleInfo.date,
  }
}

async function maybeLogLifecycleChange(args: {
  orgId?: string
  tenderId: string
  previous: {
    lifecycle: TenderLifecycle
    lifecycleDetectedAt: Date | null
    lifecycleDateSource: TenderLifecycleDateSource
  }
  next: ReturnType<typeof mapRowToScrapedPayload>
}) {
  if (!args.orgId) return
  if (args.previous.lifecycle === args.next.lifecycle) return

  const nextDateInfo = inferLifecycleDateInfo({
    lifecycle: args.next.lifecycle,
    closingDate: args.next.closingDate,
    lifecycleDetectedAt: args.next.lifecycleDetectedAt,
    lifecycleDateSource: args.next.lifecycleDateSource,
  })

  await logTenderChange({
    orgId: args.orgId,
    tenderId: args.tenderId,
    type: "LIFECYCLE_CHANGED",
    meta: {
      prevLifecycle: args.previous.lifecycle,
      nextLifecycle: args.next.lifecycle,
      prevLifecycleDetectedAt: toIsoStringOrNull(args.previous.lifecycleDetectedAt),
      nextLifecycleDetectedAt: toIsoStringOrNull(args.next.lifecycleDetectedAt),
      prevLifecycleDateSource: args.previous.lifecycleDateSource,
      nextLifecycleDateSource: nextDateInfo.source,
      nextStatus: args.next.scrapedStatus,
    },
  })

  await emitEvent({
    orgId: args.orgId,
    type: NotificationType.TENDER_CHANGED,
    entityType: "Tender",
    entityId: args.tenderId,
    meta: {
      tenderId: args.tenderId,
      kind: "LIFECYCLE_CHANGED",
      prevLifecycle: args.previous.lifecycle,
      nextLifecycle: args.next.lifecycle,
      changeDescription: `Tender lifecycle changed from ${describeLifecycle(args.previous.lifecycle)} to ${describeLifecycle(args.next.lifecycle)}.`,
    },
  })
}

async function updateTenderScrapedFields(args: {
  tenderId: string
  orgId?: string
  payload: ReturnType<typeof mapRowToScrapedPayload>
}) {
  const previousScrapedSnapshot = await loadTenderScrapedSnapshot(args.tenderId)
  const mergedDocuments = mergePersistedExternalDocuments(
    parsePersistedExternalDocumentRecords(previousScrapedSnapshot?.documents),
    args.payload.documents ?? [],
  )
  const documentsJson = JSON.stringify(mergedDocuments)
  const supportsLifecycleColumns = await hasTenderLifecycleColumns()
  const previousLifecycleState = supportsLifecycleColumns
    ? await loadTenderLifecycleState(args.tenderId)
    : null
  const lifecyclePayload =
    previousLifecycleState &&
    previousLifecycleState.lifecycle === args.payload.lifecycle &&
    previousLifecycleState.lifecycleDetectedAt &&
    args.payload.lifecycle === "awarded"
      ? {
          lifecycleDetectedAt: previousLifecycleState.lifecycleDetectedAt,
          lifecycleDateSource: previousLifecycleState.lifecycleDateSource,
        }
      : {
          lifecycleDetectedAt: args.payload.lifecycleDetectedAt,
          lifecycleDateSource: args.payload.lifecycleDateSource,
        }

  try {
    if (supportsLifecycleColumns) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "Tender"
        SET
          "externalId" = ${args.payload.externalId},
          "available" = ${args.payload.available},
          "tenderNumber" = ${args.payload.tenderNumber},
          "tenderType" = ${args.payload.tenderType},
          "eSubmission" = ${args.payload.eSubmission},
          "description" = ${args.payload.description},
          "category" = ${args.payload.category},
          "companyName" = ${args.payload.companyName},
          "province" = ${args.payload.province},
          "scrapedStatus" = ${args.payload.scrapedStatus},
          "publishedDate" = ${args.payload.publishedDate},
          "closingDate" = ${args.payload.closingDate},
          "amount" = ${args.payload.amount},
          "briefingSession" = ${args.payload.briefingSession},
          "briefingCompulsory" = ${args.payload.briefingCompulsory},
          "briefingDateTime" = ${args.payload.briefingDateTime},
          "briefingVenue" = ${args.payload.briefingVenue},
          "documents" = ${documentsJson}::jsonb,
          "lifecycle" = ${args.payload.lifecycle},
          "lifecycleDetectedAt" = ${lifecyclePayload.lifecycleDetectedAt},
          "lifecycleDateSource" = ${lifecyclePayload.lifecycleDateSource},
          "lastScrapedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE "id" = ${args.tenderId}
      `)
    } else {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "Tender"
        SET
          "externalId" = ${args.payload.externalId},
          "available" = ${args.payload.available},
          "tenderNumber" = ${args.payload.tenderNumber},
          "tenderType" = ${args.payload.tenderType},
          "eSubmission" = ${args.payload.eSubmission},
          "description" = ${args.payload.description},
          "category" = ${args.payload.category},
          "companyName" = ${args.payload.companyName},
          "province" = ${args.payload.province},
          "scrapedStatus" = ${args.payload.scrapedStatus},
          "publishedDate" = ${args.payload.publishedDate},
          "closingDate" = ${args.payload.closingDate},
          "amount" = ${args.payload.amount},
          "briefingSession" = ${args.payload.briefingSession},
          "briefingCompulsory" = ${args.payload.briefingCompulsory},
          "briefingDateTime" = ${args.payload.briefingDateTime},
          "briefingVenue" = ${args.payload.briefingVenue},
          "documents" = ${documentsJson}::jsonb,
          "lastScrapedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE "id" = ${args.tenderId}
      `)
    }
    return
  } catch (error) {
    if (!isMissingTenderScrapedColumnsError(error)) throw error
  }

  const table = await getLegacyScrapedTableName()
  if (!table || !args.orgId) return

  const tableRef = Prisma.raw(`"${table}"`)
  await prisma.$executeRaw(Prisma.sql`
    INSERT INTO ${tableRef} (
      "id",
      "orgId",
      "tenderId",
      "source",
      "externalId",
      "available",
      "tenderNumber",
      "description",
      "category",
      "companyName",
      "province",
      "status",
      "publishedDate",
      "closingDate",
      "documents",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${args.orgId},
      ${args.tenderId},
      ${args.payload.source},
      ${args.payload.externalId},
      ${args.payload.available},
      ${args.payload.tenderNumber},
      ${args.payload.description},
      ${args.payload.category},
      ${args.payload.companyName},
      ${args.payload.province},
      ${args.payload.scrapedStatus},
      ${args.payload.publishedDate},
      ${args.payload.closingDate},
      ${documentsJson}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT ("tenderId")
    DO UPDATE SET
      "source" = EXCLUDED."source",
      "externalId" = EXCLUDED."externalId",
      "available" = EXCLUDED."available",
      "tenderNumber" = EXCLUDED."tenderNumber",
      "description" = EXCLUDED."description",
      "category" = EXCLUDED."category",
      "companyName" = EXCLUDED."companyName",
      "province" = EXCLUDED."province",
      "status" = EXCLUDED."status",
      "publishedDate" = EXCLUDED."publishedDate",
      "closingDate" = EXCLUDED."closingDate",
      "documents" = EXCLUDED."documents",
      "updatedAt" = NOW()
  `)
}

async function persistTenderExternalDocuments(args: {
  tenderId: string
  orgId?: string | null
  documents: PersistedExternalTenderDocument[]
}) {
  const documentsJson = JSON.stringify(args.documents)

  try {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "Tender"
      SET
        "documents" = ${documentsJson}::jsonb,
        "updatedAt" = NOW()
      WHERE "id" = ${args.tenderId}
    `)
    return
  } catch (error) {
    if (!isMissingTenderScrapedColumnsError(error)) throw error
  }

  const table = await getLegacyScrapedTableName()
  if (!table || !args.orgId) return

  const tableRef = Prisma.raw(`"${table}"`)
  await prisma.$executeRaw(Prisma.sql`
    UPDATE ${tableRef}
    SET
      "documents" = ${documentsJson}::jsonb,
      "updatedAt" = NOW()
    WHERE "tenderId" = ${args.tenderId}
      AND "orgId" = ${args.orgId}
  `)
}

type TenderSortField = "title" | "status" | "closingDate" | "companyName"
type TenderSortDirection = "asc" | "desc"
type TenderLifecycleFilter = TenderLifecycle | "all"
export type TenderFilterOptions = {
  categories: string[]
  provinces: string[]
  organsOfState: string[]
  tenderTypes: string[]
}

function normalizeSortField(value: string | undefined): TenderSortField {
  switch (value) {
    case "title":
    case "status":
    case "companyName":
    case "closingDate":
      return value
    default:
      return "closingDate"
  }
}

function normalizeSortDirection(
  value: string | undefined,
): TenderSortDirection {
  return value === "asc" ? "asc" : "desc"
}

function normalizeLifecycle(value: string | undefined): TenderLifecycleFilter {
  switch ((value ?? "").trim().toLowerCase()) {
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

function normalizeStringList(values: string[] | undefined) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  )
}

function normalizeESubmissionFilter(value: string | undefined) {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized === "accepting") return true
  if (normalized === "not_accepting") return false
  return null
}

function buildTextInFilter(expr: Prisma.Sql, values: string[]) {
  if (values.length === 0) return Prisma.empty
  return Prisma.sql`AND LOWER(COALESCE(${expr}, '')) IN (${Prisma.join(
    values.map((value) => value.toLowerCase()),
  )})`
}

function buildAdvancedTenderFilter(args: {
  categories: string[]
  provinces: string[]
  organsOfState: string[]
  tenderTypes: string[]
  tenderNumber: string
  tenderNumberLike: string
  eSubmission: boolean | null
  categoryExpr: Prisma.Sql
  provinceExpr: Prisma.Sql
  companyExpr: Prisma.Sql
  tenderNumberExpr: Prisma.Sql
  tenderTypeExpr: Prisma.Sql
  eSubmissionExpr: Prisma.Sql
}) {
  return Prisma.sql`
    ${buildTextInFilter(args.categoryExpr, args.categories)}
    ${buildTextInFilter(args.provinceExpr, args.provinces)}
    ${buildTextInFilter(args.companyExpr, args.organsOfState)}
    ${buildTextInFilter(args.tenderTypeExpr, args.tenderTypes)}
    ${
      args.tenderNumber
        ? Prisma.sql`AND LOWER(COALESCE(${args.tenderNumberExpr}, '')) LIKE ${args.tenderNumberLike}`
        : Prisma.empty
    }
    ${
      args.eSubmission === null
        ? Prisma.empty
        : Prisma.sql`AND ${args.eSubmissionExpr} = ${args.eSubmission}`
    }
  `
}

function orderBySql(
  sortField: TenderSortField,
  sortDirection: TenderSortDirection,
  companyExpr: string,
  closingExpr: string,
) {
  const dir = sortDirection === "desc" ? "DESC" : "ASC"
  switch (sortField) {
    case "title":
      return Prisma.raw(`ORDER BY t."title" ${dir}, t."createdAt" DESC`)
    case "status":
      return Prisma.raw(`ORDER BY t."status" ${dir}, t."createdAt" DESC`)
    case "companyName":
      return Prisma.raw(
        `ORDER BY COALESCE(${companyExpr}, '') ${dir}, t."createdAt" DESC`,
      )
    case "closingDate":
    default:
      return Prisma.raw(
        `ORDER BY ${closingExpr} ${dir} NULLS LAST, t."createdAt" DESC`,
      )
  }
}

export async function listTenders(args: {
  orgId: string
  page: number
  pageSize: number
  search?: string
  sort?: string
  dir?: string
  includeHistorical?: boolean
  lifecycle?: string
  categories?: string[]
  provinces?: string[]
  organsOfState?: string[]
  tenderNumber?: string
  tenderTypes?: string[]
  eSubmission?: string
}) {
  const skip = (args.page - 1) * args.pageSize
  const sortField = normalizeSortField(args.sort)
  const sortDirection = normalizeSortDirection(args.dir)
  const searchTerm = (args.search ?? "").trim().toLowerCase()
  const searchLike = `%${searchTerm}%`
  const categories = normalizeStringList(args.categories)
  const provinces = normalizeStringList(args.provinces)
  const organsOfState = normalizeStringList(args.organsOfState)
  const tenderTypes = normalizeStringList(args.tenderTypes)
  const tenderNumber = (args.tenderNumber ?? "").trim().toLowerCase()
  const tenderNumberLike = `%${tenderNumber}%`
  const eSubmission = normalizeESubmissionFilter(args.eSubmission)
  const includeHistorical = args.includeHistorical === true
  const lifecycle = normalizeLifecycle(args.lifecycle)
  const settings = await prisma.systemSettings
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null)
  const hideClosedTenders = settings?.hideClosedTenders ?? true
  const retentionDaysRaw = settings?.retentionDays ?? 30
  const retentionDays = Number.isFinite(retentionDaysRaw)
    ? Math.max(0, retentionDaysRaw)
    : 30
  const retentionCutoff =
    retentionDays > 0
      ? new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
      : null
  const applyVisibilityFilters =
    !includeHistorical && hideClosedTenders && lifecycle === "open"
  const applyRetentionFilter = !includeHistorical && retentionCutoff !== null
  const orgScopeFilter = Prisma.sql`
    AND t."orgId" IS NULL
  `

  let rows: ListTenderRow[]
  let totals: Array<{ total: number }>
  const resolvedClosingExpr = `COALESCE(
    CASE
      WHEN BTRIM(t."closingDate") ~ '^\\d{4}-\\d{2}-\\d{2}$'
        THEN (BTRIM(t."closingDate")::date + INTERVAL '1 day' - INTERVAL '1 second')
      WHEN BTRIM(t."closingDate") ~ '^\\d{4}-\\d{2}-\\d{2}T'
        THEN BTRIM(t."closingDate")::timestamp
      ELSE NULL
    END,
    d."closingAt"
  )`
  const resolvedLifecycleExpr =
    lifecycle === "awarded"
      ? `COALESCE(t."lifecycleDetectedAt", ${resolvedClosingExpr})`
      : lifecycle === "cancelled"
        ? `COALESCE(
            CASE
              WHEN LOWER(COALESCE(t."lifecycleDateSource", '')) = 'cancelled_date'
                THEN t."lifecycleDetectedAt"
              ELSE NULL
            END,
            ${resolvedClosingExpr}
          )`
        : resolvedClosingExpr

  try {
    const activeStatusFilter = !applyVisibilityFilters
      ? Prisma.empty
      : Prisma.sql`
          AND (
            t."scrapedStatus" IS NULL
            OR LOWER(t."scrapedStatus") = 'published'
          )
        `
    const lifecycleFilter =
      lifecycle === "all"
        ? Prisma.empty
        : lifecycle === "awarded"
          ? Prisma.sql`AND LOWER(COALESCE(t."scrapedStatus", '')) LIKE '%award%'`
          : lifecycle === "closed"
            ? Prisma.sql`AND LOWER(COALESCE(t."scrapedStatus", '')) LIKE '%closed%'`
            : lifecycle === "cancelled"
              ? Prisma.sql`AND LOWER(COALESCE(t."scrapedStatus", '')) LIKE '%cancel%'`
            : Prisma.sql`AND (
                t."scrapedStatus" IS NULL
                OR LOWER(t."scrapedStatus") LIKE '%publish%'
                OR LOWER(t."scrapedStatus") LIKE '%open%'
              )`
    const closedFilter = !applyVisibilityFilters
      ? Prisma.empty
      : Prisma.sql`
          AND (
            COALESCE(
              CASE
                WHEN BTRIM(t."closingDate") ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                  THEN (BTRIM(t."closingDate")::date + INTERVAL '1 day' - INTERVAL '1 second')
                WHEN BTRIM(t."closingDate") ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
                  THEN BTRIM(t."closingDate")::timestamp
                ELSE NULL
              END,
              d."closingAt"
            ) IS NULL
            OR COALESCE(
              CASE
                WHEN BTRIM(t."closingDate") ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                  THEN (BTRIM(t."closingDate")::date + INTERVAL '1 day' - INTERVAL '1 second')
                WHEN BTRIM(t."closingDate") ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
                  THEN BTRIM(t."closingDate")::timestamp
                ELSE NULL
              END,
              d."closingAt"
            ) >= NOW()
          )
        `
    const retentionFilter = applyRetentionFilter
      ? Prisma.sql`AND t."createdAt" >= ${retentionCutoff!}`
      : Prisma.empty
    const searchFilter = searchTerm
      ? Prisma.sql`AND (
          LOWER(t."title") LIKE ${searchLike}
          OR LOWER(COALESCE(t."companyName", '')) LIKE ${searchLike}
        )`
      : Prisma.empty
    const advancedFilter = buildAdvancedTenderFilter({
      categories,
      provinces,
      organsOfState,
      tenderTypes,
      tenderNumber,
      tenderNumberLike,
      eSubmission,
      companyExpr: Prisma.sql`t."companyName"`,
      categoryExpr: Prisma.sql`t."category"`,
      provinceExpr: Prisma.sql`t."province"`,
      tenderNumberExpr: Prisma.sql`t."tenderNumber"`,
      tenderTypeExpr: Prisma.sql`t."tenderType"`,
      eSubmissionExpr: Prisma.sql`t."eSubmission"`,
    })
    const orderBy = orderBySql(
      sortField,
      sortDirection,
      `t."companyName"`,
      resolvedLifecycleExpr,
    )

    ;[rows, totals] = await prisma.$transaction([
      prisma.$queryRaw<ListTenderRow[]>(Prisma.sql`
        SELECT
          t."id",
          t."orgId",
          t."title",
          t."source",
          t."status",
          t."createdByUserId",
          t."createdAt",
          t."updatedAt",
          d."closingAt" AS "deadlineClosingAt",
          t."closingDate" AS "tenderClosingDate",
          t."lifecycle",
          t."lifecycleDetectedAt",
          t."lifecycleDateSource",
          t."companyName",
          t."category",
          t."province",
          t."tenderNumber",
          t."tenderType",
          t."eSubmission",
          t."scrapedStatus",
          t."amount"
        FROM "Tender" t
        LEFT JOIN "TenderDeadline" d ON d."tenderId" = t."id"
        WHERE t."source" IS DISTINCT FROM ${ORG_PROFILE_TENDER_SOURCE}
        ${orgScopeFilter}
        ${lifecycleFilter}
        ${activeStatusFilter}
        ${closedFilter}
        ${retentionFilter}
        ${searchFilter}
        ${advancedFilter}
        ${orderBy}
        OFFSET ${skip}
        LIMIT ${args.pageSize}
      `),
      prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS "total"
        FROM "Tender" t
        LEFT JOIN "TenderDeadline" d ON d."tenderId" = t."id"
        WHERE t."source" IS DISTINCT FROM ${ORG_PROFILE_TENDER_SOURCE}
        ${orgScopeFilter}
        ${lifecycleFilter}
        ${activeStatusFilter}
        ${closedFilter}
        ${retentionFilter}
        ${searchFilter}
        ${advancedFilter}
      `),
    ])
  } catch (error) {
    if (!isMissingTenderScrapedColumnsError(error)) throw error

    try {
      const activeStatusFilter = !applyVisibilityFilters
        ? Prisma.empty
        : Prisma.sql`
            AND (
              t."scrapedStatus" IS NULL
              OR LOWER(t."scrapedStatus") = 'published'
            )
          `
      const lifecycleFilter =
        lifecycle === "all"
          ? Prisma.empty
          : lifecycle === "awarded"
            ? Prisma.sql`AND LOWER(COALESCE(t."scrapedStatus", s."status", '')) LIKE '%award%'`
            : lifecycle === "closed"
              ? Prisma.sql`AND LOWER(COALESCE(t."scrapedStatus", s."status", '')) LIKE '%closed%'`
              : lifecycle === "cancelled"
                ? Prisma.sql`AND LOWER(COALESCE(t."scrapedStatus", s."status", '')) LIKE '%cancel%'`
              : Prisma.sql`AND (
                  COALESCE(t."scrapedStatus", s."status") IS NULL
                  OR LOWER(COALESCE(t."scrapedStatus", s."status", '')) LIKE '%publish%'
                  OR LOWER(COALESCE(t."scrapedStatus", s."status", '')) LIKE '%open%'
                )`
      const table = await getLegacyScrapedTableName()
      const tableRef = table ? Prisma.raw(`"${table}"`) : null
      const companySelect = table
        ? Prisma.sql`s."companyName"`
        : Prisma.sql`NULL::text AS "companyName"`
      const categorySelect = table
        ? Prisma.sql`s."category"`
        : Prisma.sql`NULL::text AS "category"`
      const provinceSelect = table
        ? Prisma.sql`s."province"`
        : Prisma.sql`NULL::text AS "province"`
      const tenderNumberSelect = table
        ? Prisma.sql`s."tenderNumber"`
        : Prisma.sql`NULL::text AS "tenderNumber"`
      const scrapedStatusSelect = table
        ? Prisma.sql`COALESCE(t."scrapedStatus", s."status") AS "scrapedStatus"`
        : Prisma.sql`t."scrapedStatus"`
      const closingSelect = table
        ? Prisma.sql`s."closingDate" AS "tenderClosingDate"`
        : Prisma.sql`NULL::text AS "tenderClosingDate"`
      const lifecycleSelect = Prisma.sql`NULL::text AS "lifecycle"`
      const lifecycleDetectedAtSelect =
        Prisma.sql`NULL::timestamp AS "lifecycleDetectedAt"`
      const lifecycleDateSourceSelect =
        Prisma.sql`NULL::text AS "lifecycleDateSource"`
      const maybeJoin = table
        ? Prisma.sql`LEFT JOIN ${tableRef!} s ON s."tenderId" = t."id"`
        : Prisma.empty

      const closedFilter = !applyVisibilityFilters
        ? Prisma.empty
        : Prisma.sql`
            AND (
              COALESCE(
                CASE
                  WHEN BTRIM(t."closingDate") ~ '^\d{4}-\d{2}-\d{2}$'
                    THEN (BTRIM(t."closingDate")::date + INTERVAL '1 day' - INTERVAL '1 second')
                  WHEN BTRIM(t."closingDate") ~ '^\d{4}-\d{2}-\d{2}T'
                    THEN BTRIM(t."closingDate")::timestamp
                  ELSE NULL
                END,
                d."closingAt"
              ) IS NULL
              OR COALESCE(
                CASE
                  WHEN BTRIM(t."closingDate") ~ '^\d{4}-\d{2}-\d{2}$'
                    THEN (BTRIM(t."closingDate")::date + INTERVAL '1 day' - INTERVAL '1 second')
                  WHEN BTRIM(t."closingDate") ~ '^\d{4}-\d{2}-\d{2}T'
                    THEN BTRIM(t."closingDate")::timestamp
                  ELSE NULL
                END,
                d."closingAt"
              ) >= NOW()
            )
          `
      const searchFilter = searchTerm
        ? Prisma.sql`AND (
            LOWER(t."title") LIKE ${searchLike}
            OR LOWER(COALESCE(t."companyName", s."companyName", '')) LIKE ${searchLike}
          )`
        : Prisma.empty
      const advancedFilter = buildAdvancedTenderFilter({
        categories,
        provinces,
        organsOfState,
        tenderTypes,
        tenderNumber,
        tenderNumberLike,
        eSubmission,
        companyExpr: Prisma.sql`COALESCE(t."companyName", s."companyName")`,
        categoryExpr: Prisma.sql`COALESCE(t."category", s."category")`,
        provinceExpr: Prisma.sql`COALESCE(t."province", s."province")`,
        tenderNumberExpr: Prisma.sql`COALESCE(t."tenderNumber", s."tenderNumber")`,
        tenderTypeExpr: Prisma.sql`NULL::text`,
        eSubmissionExpr: Prisma.sql`NULL::boolean`,
      })
      const retentionFilter = applyRetentionFilter
        ? Prisma.sql`AND t."createdAt" >= ${retentionCutoff!}`
        : Prisma.empty
      const orderBy = orderBySql(
        sortField,
        sortDirection,
        `COALESCE(t."companyName", s."companyName")`,
        resolvedClosingExpr,
      )

      ;[rows, totals] = await prisma.$transaction([
        prisma.$queryRaw<ListTenderRow[]>(Prisma.sql`
          SELECT
            t."id",
            t."orgId",
            t."title",
            t."source",
            t."status",
            t."createdByUserId",
            t."createdAt",
            t."updatedAt",
            d."closingAt" AS "deadlineClosingAt",
            ${closingSelect},
            ${lifecycleSelect},
            ${lifecycleDetectedAtSelect},
            ${lifecycleDateSourceSelect},
            ${companySelect},
            ${categorySelect},
            ${provinceSelect},
            ${tenderNumberSelect},
            NULL::text AS "tenderType",
            NULL::boolean AS "eSubmission",
            ${scrapedStatusSelect},
            NULL::text AS "amount"
          FROM "Tender" t
          LEFT JOIN "TenderDeadline" d ON d."tenderId" = t."id"
          ${maybeJoin}
          WHERE t."source" IS DISTINCT FROM ${ORG_PROFILE_TENDER_SOURCE}
          ${orgScopeFilter}
          ${lifecycleFilter}
          ${activeStatusFilter}
          ${closedFilter}
          ${retentionFilter}
          ${searchFilter}
          ${advancedFilter}
          ${orderBy}
          OFFSET ${skip}
          LIMIT ${args.pageSize}
        `),
        prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
          SELECT COUNT(*)::int AS "total"
          FROM "Tender" t
          LEFT JOIN "TenderDeadline" d ON d."tenderId" = t."id"
          WHERE t."source" IS DISTINCT FROM ${ORG_PROFILE_TENDER_SOURCE}
          ${orgScopeFilter}
          ${lifecycleFilter}
          ${activeStatusFilter}
          ${closedFilter}
          ${retentionFilter}
          ${searchFilter}
          ${advancedFilter}
        `),
      ])
    } catch {
      const activeStatusFilter = !applyVisibilityFilters
        ? Prisma.empty
        : Prisma.sql`
            AND (
              t."scrapedStatus" IS NULL
              OR LOWER(t."scrapedStatus") = 'published'
            )
          `
      const lifecycleFilter =
        lifecycle === "all"
          ? Prisma.empty
          : lifecycle === "awarded"
            ? Prisma.sql`AND LOWER(COALESCE(t."scrapedStatus", '')) LIKE '%award%'`
            : lifecycle === "closed"
              ? Prisma.sql`AND LOWER(COALESCE(t."scrapedStatus", '')) LIKE '%closed%'`
              : lifecycle === "cancelled"
                ? Prisma.sql`AND LOWER(COALESCE(t."scrapedStatus", '')) LIKE '%cancel%'`
              : Prisma.sql`AND (
                  t."scrapedStatus" IS NULL
                  OR LOWER(COALESCE(t."scrapedStatus", '')) LIKE '%publish%'
                  OR LOWER(COALESCE(t."scrapedStatus", '')) LIKE '%open%'
                )`
      const closedFilter = !applyVisibilityFilters
        ? Prisma.empty
        : Prisma.sql`
            AND (
              COALESCE(
                CASE
                  WHEN BTRIM(t."closingDate") ~ '^\d{4}-\d{2}-\d{2}$'
                    THEN (BTRIM(t."closingDate")::date + INTERVAL '1 day' - INTERVAL '1 second')
                  WHEN BTRIM(t."closingDate") ~ '^\d{4}-\d{2}-\d{2}T'
                    THEN BTRIM(t."closingDate")::timestamp
                  ELSE NULL
                END,
                d."closingAt"
              ) IS NULL
              OR COALESCE(
                CASE
                  WHEN BTRIM(t."closingDate") ~ '^\d{4}-\d{2}-\d{2}$'
                    THEN (BTRIM(t."closingDate")::date + INTERVAL '1 day' - INTERVAL '1 second')
                  WHEN BTRIM(t."closingDate") ~ '^\d{4}-\d{2}-\d{2}T'
                    THEN BTRIM(t."closingDate")::timestamp
                  ELSE NULL
                END,
                d."closingAt"
              ) >= NOW()
            )
          `
      const searchFilter = searchTerm
        ? Prisma.sql`AND LOWER(t."title") LIKE ${searchLike}`
        : Prisma.empty
      const advancedFilter = buildAdvancedTenderFilter({
        categories,
        provinces,
        organsOfState,
        tenderTypes,
        tenderNumber,
        tenderNumberLike,
        eSubmission,
        companyExpr: Prisma.sql`NULL::text`,
        categoryExpr: Prisma.sql`NULL::text`,
        provinceExpr: Prisma.sql`NULL::text`,
        tenderNumberExpr: Prisma.sql`NULL::text`,
        tenderTypeExpr: Prisma.sql`NULL::text`,
        eSubmissionExpr: Prisma.sql`NULL::boolean`,
      })
      const retentionFilter = applyRetentionFilter
        ? Prisma.sql`AND t."createdAt" >= ${retentionCutoff!}`
        : Prisma.empty
      const orderBy = orderBySql(
        sortField,
        sortDirection,
        `NULL`,
        resolvedClosingExpr,
      )

      ;[rows, totals] = await prisma.$transaction([
        prisma.$queryRaw<ListTenderRow[]>(Prisma.sql`
          SELECT
            t."id",
            t."orgId",
            t."title",
            t."source",
            t."status",
            t."createdByUserId",
            t."createdAt",
            t."updatedAt",
            d."closingAt" AS "deadlineClosingAt",
            NULL::text AS "tenderClosingDate",
            NULL::text AS "lifecycle",
            NULL::timestamp AS "lifecycleDetectedAt",
            NULL::text AS "lifecycleDateSource",
            NULL::text AS "companyName",
            NULL::text AS "category",
            NULL::text AS "province",
            NULL::text AS "tenderNumber",
            NULL::text AS "tenderType",
            NULL::boolean AS "eSubmission",
            t."scrapedStatus",
            NULL::text AS "amount"
          FROM "Tender" t
          LEFT JOIN "TenderDeadline" d ON d."tenderId" = t."id"
          WHERE t."source" IS DISTINCT FROM ${ORG_PROFILE_TENDER_SOURCE}
          ${orgScopeFilter}
          ${lifecycleFilter}
          ${activeStatusFilter}
          ${closedFilter}
          ${retentionFilter}
          ${searchFilter}
          ${advancedFilter}
          ${orderBy}
          OFFSET ${skip}
          LIMIT ${args.pageSize}
        `),
        prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
          SELECT COUNT(*)::int AS "total"
          FROM "Tender" t
          LEFT JOIN "TenderDeadline" d ON d."tenderId" = t."id"
          WHERE t."source" IS DISTINCT FROM ${ORG_PROFILE_TENDER_SOURCE}
          ${orgScopeFilter}
          ${lifecycleFilter}
          ${activeStatusFilter}
          ${closedFilter}
          ${retentionFilter}
          ${searchFilter}
          ${advancedFilter}
        `),
      ])
    }
  }

  const total = totals[0]?.total ?? 0
  const items = rows.map((row) => {
    const tenderClosingDate = row.tenderClosingDate ?? null
    const inferredLifecycle = inferTenderLifecycle({
      scrapedStatus: row.scrapedStatus,
      closingDate: tenderClosingDate,
    })
    const lifecycle =
      row.lifecycle === "awarded" ||
      row.lifecycle === "closed" ||
      row.lifecycle === "cancelled" ||
      row.lifecycle === "open"
        ? row.lifecycle
        : inferredLifecycle
    const lifecycleDateInfo = inferLifecycleDateInfo({
      lifecycle,
      closingDate: tenderClosingDate,
      lifecycleDetectedAt: row.lifecycleDetectedAt,
      lifecycleDateSource: row.lifecycleDateSource,
    })
    const displayDate =
      lifecycle === "open"
        ? row.deadlineClosingAt?.toISOString() ?? tenderClosingDate
        : toIsoStringOrNull(lifecycleDateInfo.date) ??
          tenderClosingDate ??
          row.deadlineClosingAt?.toISOString() ??
          null

    return {
      id: row.id,
      orgId: row.orgId,
      title: row.title,
      source: row.source,
      status: row.status,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      closingDate: displayDate,
      companyName: row.companyName?.trim() || null,
      category: row.category?.trim() || null,
      province: row.province?.trim() || null,
      tenderNumber: row.tenderNumber?.trim() || null,
      tenderType: row.tenderType?.trim() || null,
      eSubmission: row.eSubmission,
      amount: row.amount?.trim() || null,
      lifecycle,
    }
  })

  return { items, total }
}

function sortOptionValues(values: Array<string | null>) {
  return Array.from(
    new Set(values.map((value) => (value ?? "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))
}

export async function getTenderFilterOptions(): Promise<TenderFilterOptions> {
  const rows = await prisma.$queryRaw<
    Array<{
      category: string | null
      province: string | null
      companyName: string | null
      tenderType: string | null
    }>
  >(Prisma.sql`
    SELECT DISTINCT
      "category",
      "province",
      "companyName",
      "tenderType"
    FROM "Tender"
    WHERE "source" IS DISTINCT FROM ${ORG_PROFILE_TENDER_SOURCE}
      AND "orgId" IS NULL
  `)

  return {
    categories: sortOptionValues(rows.map((row) => row.category)),
    provinces: sortOptionValues(rows.map((row) => row.province)),
    organsOfState: sortOptionValues(rows.map((row) => row.companyName)),
    tenderTypes: sortOptionValues(rows.map((row) => row.tenderType)),
  }
}

export async function getTender(args: {
  orgId?: string | null
  tenderId: string
}) {
  const t = await prisma.tender.findFirst({
    where: {
      id: args.tenderId,
      OR: [
        {
          orgId: null,
          source: { not: ORG_PROFILE_TENDER_SOURCE },
        },
        ...(args.orgId
          ? [
              {
                orgId: args.orgId,
                source: ORG_PROFILE_TENDER_SOURCE,
              },
            ]
          : []),
      ],
    },
  })
  if (!t) throw new AppError("NOT_FOUND", "Tender not found", 404)
  return t
}

export async function listTenderFiles(args: {
  orgId?: string | null
  tenderId: string
}) {
  await getTender(args)
  const files = await prisma.tenderFile.findMany({
    where: { orgId: args.orgId ?? undefined, tenderId: args.tenderId },
    orderBy: { createdAt: "desc" },
  })
  return files
    .filter((file) => !isHiddenTenderFileForUser(file.originalFilename))
    .map((file) => ({
      ...file,
      originalFilename: deriveDisplayFilename({
        originalFilename: file.originalFilename,
        storageKey: file.storageKey,
        mimeType: file.mimeType,
      }),
    }))
}

export async function listTenderJobs(args: {
  orgId?: string | null
  tenderId: string
}) {
  await getTender(args)
  return prisma.processingJob.findMany({
    where: { orgId: args.orgId ?? undefined, tenderId: args.tenderId },
    orderBy: { createdAt: "desc" },
  })
}

export async function getTenderExtract(args: {
  orgId?: string | null
  tenderId: string
}) {
  await getTender(args)
  const extract = await prisma.tenderExtract.findFirst({
    where: { tenderId: args.tenderId, orgId: args.orgId ?? undefined },
    orderBy: { createdAt: "desc" },
  })
  if (!extract) throw new AppError("NOT_FOUND", "Extract not found", 404)
  return extract
}

export async function createProcessingJob(args: {
  orgId: string
  tenderId: string
  tenderFileId: string
}) {
  const job = await prisma.processingJob.create({
    data: {
      orgId: args.orgId,
      tenderId: args.tenderId,
      tenderFileId: args.tenderFileId,
      type: JobType.EXTRACT_TEXT,
      status: JobStatus.QUEUED,
    },
  })

  await prisma.tender.update({
    where: { id: args.tenderId },
    data: { status: TenderStatus.QUEUED },
  })

  return job
}

async function fetchETendersPage(args: {
  start: number
  length: number
  status: number
}) {
  const url = new URL(ETENDERS_DEFAULT_URL)
  url.searchParams.set("start", String(args.start))
  url.searchParams.set("length", String(args.length))
  url.searchParams.set("status", String(args.status))
  url.searchParams.set("_", String(Date.now()))

  let lastError: unknown = null

  for (let attempt = 1; attempt <= ETENDERS_FEED_FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": ETENDERS_FEED_USER_AGENT,
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(ETENDERS_FEED_FETCH_TIMEOUT_MS),
      })

      if (!res.ok) {
        const shouldRetryStatus =
          res.status >= 500 || res.status === 429 || res.status === 408
        if (shouldRetryStatus && attempt < ETENDERS_FEED_FETCH_ATTEMPTS) {
          await delay(ETENDERS_FEED_RETRY_BASE_DELAY_MS * attempt)
          continue
        }

        throw new AppError(
          "ETENDERS_FETCH_FAILED",
          `Failed to fetch eTenders feed (${res.status})`,
          502,
        )
      }

      const payload = (await res.json()) as ETendersPayload
      return {
        rows: payload.data ?? [],
        recordsTotal: payload.recordsTotal ?? 0,
        recordsFiltered: payload.recordsFiltered ?? 0,
      }
    } catch (error) {
      lastError = error
      const shouldRetry =
        !(error instanceof AppError) &&
        isRetriableETendersFetchError(error) &&
        attempt < ETENDERS_FEED_FETCH_ATTEMPTS

      if (shouldRetry) {
        await delay(ETENDERS_FEED_RETRY_BASE_DELAY_MS * attempt)
        continue
      }

      if (error instanceof AppError) throw error

      throw new AppError(
        "ETENDERS_FETCH_FAILED",
        `Failed to fetch eTenders feed: ${getErrorMessage(error)}`,
        502,
      )
    }
  }

  throw new AppError(
    "ETENDERS_FETCH_FAILED",
    `Failed to fetch eTenders feed after ${ETENDERS_FEED_FETCH_ATTEMPTS} attempts: ${getErrorMessage(lastError)}`,
    502,
  )
}

function parseETenderIdFromSource(source: string | null) {
  if (!source) return null
  const match = /^etenders:(\d+):/.exec(source.trim())
  if (!match) return null
  return Number(match[1])
}

function normalizeExtension(raw?: string) {
  if (!raw) return ""
  const ext = raw.trim().toLowerCase()
  if (!ext) return ""
  return ext.startsWith(".") ? ext : `.${ext}`
}

function extensionFromFileName(fileName: string) {
  const lastDot = fileName.lastIndexOf(".")
  if (lastDot < 0 || lastDot === fileName.length - 1) return ""
  return normalizeExtension(fileName.slice(lastDot + 1))
}

function buildETendersDownloadPath(
  docId: string,
  fileName: string,
  extension?: string,
) {
  const id = docId.trim()
  const ext = normalizeExtension(extension) || extensionFromFileName(fileName)
  const blobName = `${id}${ext}`
  const base = "https://www.etenders.gov.za/home/Download/?blobName="

  let normalizedName = fileName
  try {
    normalizedName = decodeURIComponent(fileName)
  } catch {
    normalizedName = fileName
  }

  return `${base}${blobName}&downloadedFileName=${encodeURIComponent(normalizedName)}`
}

function mapRowToExternalDocuments(
  row: ETenderRow,
): PersistedExternalTenderDocument[] {
  const docs = row.supportDocument ?? []
  return docs
    .filter((doc) => doc.supportDocumentID && doc.fileName)
    .map((doc) => ({
      id: doc.supportDocumentID,
      name: doc.fileName,
      path: buildETendersDownloadPath(
        doc.supportDocumentID,
        doc.fileName,
        doc.extension,
      ),
      archivedStorageKey: null,
      archivedMimeType: null,
      archivedSizeBytes: null,
      archivedChecksumSha256: null,
      archivedAt: null,
    }))
}

async function fetchETenderDetailsDocuments(
  row: ETenderRow,
): Promise<PersistedExternalTenderDocument[]> {
  const scrapedDocs = await fetchETenderDetailsDocumentsById(row.id)
  if (scrapedDocs.length > 0) return scrapedDocs

  return mapRowToExternalDocuments(row)
}

function normalizeFeedStatus(status: number, rawStatus: string | null) {
  if (status === 2) return "Awarded"
  if (status === 3) return "Closed"
  if (status === 4) return "Cancelled"
  const candidate = (rawStatus ?? "").trim()
  if (candidate) return candidate
  return "Published"
}

function extractTenderAmount(row: ETenderRow) {
  const direct = (row.tenderAmount ?? "").trim()
  if (direct) return direct

  if (Array.isArray(row.awards)) {
    for (const award of row.awards) {
      const fromAward = (award?.tenderAmount ?? "").trim()
      if (fromAward) return fromAward
    }
  }

  return null
}

function normalizeAwardedCompanyName(value: string | null | undefined) {
  const normalized = (value ?? "").replace(/[\s\u00a0]+/g, " ").trim()
  return normalized || null
}

function extractAwardedCompanyName(row: ETenderRow) {
  const candidates: string[] = []

  if (Array.isArray(row.awards)) {
    for (const award of row.awards) {
      const company = normalizeAwardedCompanyName(award?.company)
      if (company) candidates.push(company)
    }
  }

  if (Array.isArray(row.company)) {
    for (const award of row.company) {
      const company = normalizeAwardedCompanyName(award?.company)
      if (company) candidates.push(company)
    }
  }

  const bidders = normalizeAwardedCompanyName(row.bidders)
  if (bidders) candidates.push(bidders)

  const unique = Array.from(
    new Map(
      candidates.map((company) => [
        company.replace(/[\s\u00a0]+/g, " ").trim().toLowerCase(),
        company,
      ]),
    ).values(),
  )
  return unique.length > 0 ? unique.join(", ") : null
}

function extractTenderClosingDate(row: ETenderRow) {
  const closing = (row.closing_Date ?? "").trim()
  if (closing) return closing

  return null
}

function extractTenderCancelledDate(row: ETenderRow) {
  const cancelled = (row.cancelled_Date ?? row.canceled_Date ?? "").trim()
  if (cancelled) return cancelled

  return null
}

function extractBriefingDateTime(row: ETenderRow) {
  const value = (row.compulsory_briefing_session ?? "").trim()
  if (!value) return null
  return value
}

function inferLifecycleDateSourceFromRow(
  row: ETenderRow,
  lifecycle: TenderLifecycle,
): TenderLifecycleDateSource {
  if (lifecycle === "awarded") return "import_detected_at"
  if (
    lifecycle === "cancelled" &&
    String(row.cancelled_Date ?? row.canceled_Date ?? "").trim()
  ) {
    return "cancelled_date"
  }
  if (String(row.closing_Date ?? "").trim()) return "closing_date"
  return "unknown"
}

function normalizeESubmission(value: ETenderRow["eSubmission"]) {
  if (typeof value === "boolean") return value
  const normalized = String(value ?? "").trim().toLowerCase()
  if (!normalized) return null
  if (["true", "yes", "y", "1", "accepting"].includes(normalized)) return true
  if (["false", "no", "n", "0", "not accepting"].includes(normalized)) {
    return false
  }
  return null
}

function mapRowToScrapedPayload(
  row: ETenderRow,
  docs: PersistedExternalTenderDocument[],
  feedStatus: number,
) {
  const scrapedStatus = normalizeFeedStatus(feedStatus, row.status)
  const closingDate = extractTenderClosingDate(row)
  const cancelledDate = extractTenderCancelledDate(row)
  const lifecycle = inferTenderLifecycle({
    scrapedStatus,
    closingDate: closingDate ?? cancelledDate,
  })
  const lifecycleDateSource = inferLifecycleDateSourceFromRow(row, lifecycle)
  return {
    source: "etenders.gov.za",
    externalId: row.id,
    available: true,
    tenderNumber: row.tender_No ?? null,
    tenderType:
      (row.tenderType ?? row.tender_Type ?? "").toString().trim() || null,
    eSubmission: normalizeESubmission(row.eSubmission),
    description: row.description ?? null,
    category: row.category ?? null,
    companyName:
      lifecycle === "awarded"
        ? extractAwardedCompanyName(row) ?? row.organ_of_State ?? null
        : row.organ_of_State ?? null,
    province: row.province ?? null,
    scrapedStatus,
    publishedDate: row.date_Published ?? null,
    closingDate,
    amount: extractTenderAmount(row),
    briefingSession:
      typeof row.briefingSession === "boolean" ? row.briefingSession : null,
    briefingCompulsory:
      typeof row.briefingCompulsory === "boolean"
        ? row.briefingCompulsory
        : null,
    briefingDateTime: extractBriefingDateTime(row),
    briefingVenue: (row.briefingVenue ?? "").trim() || null,
    lifecycle,
    lifecycleDateSource,
    lifecycleDetectedAt:
      lifecycle === "awarded"
        ? new Date()
        : lifecycleDateSource === "cancelled_date"
          ? parseDateLike(cancelledDate)
          : lifecycleDateSource === "closing_date"
            ? parseDateLike(closingDate)
            : null,
    documents: docs,
  }
}

function parsePersistedExternalDocumentRecords(
  value: unknown,
): PersistedExternalTenderDocument[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const doc = entry as Record<string, unknown>
      if (
        typeof doc.id !== "string" ||
        typeof doc.name !== "string" ||
        typeof doc.path !== "string"
      ) {
        return null
      }
      return {
        id: doc.id,
        name: doc.name,
        path: doc.path,
        archivedStorageKey:
          typeof doc.archivedStorageKey === "string"
            ? doc.archivedStorageKey
            : null,
        archivedMimeType:
          typeof doc.archivedMimeType === "string" ? doc.archivedMimeType : null,
        archivedSizeBytes:
          typeof doc.archivedSizeBytes === "number" ? doc.archivedSizeBytes : null,
        archivedChecksumSha256:
          typeof doc.archivedChecksumSha256 === "string"
            ? doc.archivedChecksumSha256
            : null,
        archivedAt:
          typeof doc.archivedAt === "string" ? doc.archivedAt : null,
      } satisfies PersistedExternalTenderDocument
    })
    .filter((item): item is PersistedExternalTenderDocument => item !== null)
}

export function mergePersistedExternalDocuments(
  existing: PersistedExternalTenderDocument[],
  incoming: PersistedExternalTenderDocument[],
) {
  if (incoming.length === 0) return existing.map((doc) => ({ ...doc }))

  const byId = new Map(existing.map((doc) => [doc.id, doc]))
  const merged: PersistedExternalTenderDocument[] = []
  const seenIds = new Set<string>()

  for (const doc of incoming) {
    const previous = byId.get(doc.id)
    merged.push({
      ...previous,
      ...doc,
      archivedStorageKey: doc.archivedStorageKey ?? previous?.archivedStorageKey ?? null,
      archivedMimeType: doc.archivedMimeType ?? previous?.archivedMimeType ?? null,
      archivedSizeBytes: doc.archivedSizeBytes ?? previous?.archivedSizeBytes ?? null,
      archivedChecksumSha256:
        doc.archivedChecksumSha256 ?? previous?.archivedChecksumSha256 ?? null,
      archivedAt: doc.archivedAt ?? previous?.archivedAt ?? null,
    })
    seenIds.add(doc.id)
  }

  for (const doc of existing) {
    if (seenIds.has(doc.id)) continue
    merged.push({ ...doc })
  }

  return merged
}

async function archiveExternalTenderDocument(args: {
  tenderId: string
  document: PersistedExternalTenderDocument
}) {
  if (args.document.archivedStorageKey) return args.document

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    EXTERNAL_TENDER_ARCHIVE_FETCH_TIMEOUT_MS,
  )

  try {
    const response = await fetch(args.document.path, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": ETENDERS_FEED_USER_AGENT,
        Accept: "*/*",
      },
    })
    if (!response.ok) return args.document

    const mimeType = pickExternalDocumentMimeType(
      response.headers.get("content-type"),
      args.document.name,
    )
    if (!mimeType || !EXTERNAL_TENDER_ARCHIVABLE_MIME_TYPES.has(mimeType)) {
      return args.document
    }

    const arrayBuffer = await response.arrayBuffer()
    const buf = Buffer.from(arrayBuffer)
    if (!buf.length || buf.length > EXTERNAL_TENDER_ARCHIVE_MAX_BYTES) {
      return args.document
    }
    if (looksLikeHtmlDocument(buf)) return args.document

    const safeName =
      normalizeExternalDocumentName(args.document)
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .trim() || `external-${args.document.id}`
    const key = `tenders/external-documents/${args.tenderId}/${crypto.randomUUID()}-${safeName}`
    const checksum = sha256(buf)
    const stored = await storage().putObject({
      key,
      body: buf,
      mimeType,
    })

    return {
      ...args.document,
      archivedStorageKey: stored.key,
      archivedMimeType: stored.mimeType,
      archivedSizeBytes: stored.sizeBytes,
      archivedChecksumSha256: stored.checksumSha256 || checksum,
      archivedAt: new Date().toISOString(),
    } satisfies PersistedExternalTenderDocument
  } catch {
    return args.document
  } finally {
    clearTimeout(timeout)
  }
}

async function archiveExternalTenderDocuments(args: {
  tenderId: string
  documents: PersistedExternalTenderDocument[]
}) {
  const archived: PersistedExternalTenderDocument[] = []
  let changed = false

  for (const doc of args.documents) {
    const next = await archiveExternalTenderDocument({
      tenderId: args.tenderId,
      document: doc,
    })
    if (next.archivedStorageKey && next.archivedStorageKey !== doc.archivedStorageKey) {
      changed = true
    }
    archived.push(next)
  }

  return { documents: archived, changed }
}

async function fetchETenderDetailsDocumentsById(
  externalId: number,
): Promise<PersistedExternalTenderDocument[]> {
  try {
    const detailsUrl = `https://www.etenders.gov.za/Home/TenderOpportunitiesDetails?id=${externalId}`
    const res = await fetch(detailsUrl, {
      method: "GET",
      headers: {
        "User-Agent": ETENDERS_FEED_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    })

    if (!res.ok) return []

    const html = await res.text()
    const regex = /href=['"]([^'"]*home\/Download\/\?blobName=[^'"]+)['"]/gi
    let match
    const scrapedDocs: PersistedExternalTenderDocument[] = []
    const seenIds = new Set<string>()

    while ((match = regex.exec(html)) !== null) {
      let urlStr = match[1]
      urlStr = urlStr.replace(/&amp;/g, "&")

      if (!urlStr.startsWith("http")) {
        urlStr = `https://www.etenders.gov.za${urlStr.startsWith("/") ? "" : "/"}${urlStr}`
      }

      try {
        const parsedUrl = new URL(urlStr)
        const blobName = parsedUrl.searchParams.get("blobName") || ""
        const downloadedFileName =
          parsedUrl.searchParams.get("downloadedFileName") || ""

        const idMatch =
          /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(
            blobName,
          )
        const docId = idMatch ? idMatch[1] : blobName
        const fileName = downloadedFileName || blobName

          if (docId && !seenIds.has(docId)) {
            seenIds.add(docId)
            scrapedDocs.push({
              id: docId,
              name: fileName,
              path: urlStr,
              archivedStorageKey: null,
              archivedMimeType: null,
              archivedSizeBytes: null,
              archivedChecksumSha256: null,
              archivedAt: null,
            })
          }
      } catch {
        // ignore parsing error for this link
      }
    }

    return scrapedDocs
  } catch {
    return []
  }
}

async function recoverTenderExternalDocuments(args: {
  tenderId: string
  orgId?: string | null
  source: string | null
  externalId: number | null
  documents: PersistedExternalTenderDocument[]
}) {
  if (args.documents.length > 0) return args.documents

  const externalId = args.externalId ?? parseETenderIdFromSource(args.source)
  if (!externalId) return args.documents

  const recovered = await fetchETenderDetailsDocumentsById(externalId)
  if (recovered.length === 0) return args.documents

  const merged = mergePersistedExternalDocuments(args.documents, recovered)
  await persistTenderExternalDocuments({
    tenderId: args.tenderId,
    orgId: args.orgId,
    documents: merged,
  })
  return merged
}

function mapPersistedExternalDocumentsToClient(
  tenderId: string,
  documents: PersistedExternalTenderDocument[],
): ExternalTenderDocument[] {
  return documents.map((doc) => ({
    id: doc.id,
    name: normalizeExternalDocumentName({
      id: doc.id,
      name: doc.name,
      path: doc.path,
    }),
    path: doc.archivedStorageKey
      ? buildArchivedExternalDocumentDownloadPath({
          tenderId,
          documentId: doc.id,
        })
      : doc.path,
  }))
}

export async function getScrapedTenderDataForTender(args: {
  orgId?: string | null
  tenderId: string
}): Promise<ScrapedTenderData> {
  const tender = await getTender({ orgId: args.orgId, tenderId: args.tenderId })
  const stored = await loadTenderScrapedSnapshot(tender.id)

  if (!stored) {
    const externalId = parseETenderIdFromSource(tender.source)
    return emptyScrapedData({
      source: inferScrapedSource(tender.source),
      externalId,
    })
  }

  return {
    source: inferScrapedSource(stored.source),
    externalId: stored.externalId ?? parseETenderIdFromSource(stored.source),
    available: stored.available,
    tenderNumber: stored.tenderNumber,
    tenderType: stored.tenderType,
    eSubmission: stored.eSubmission,
    description: stored.description,
    category: stored.category,
    companyName: stored.companyName,
    province: stored.province,
    status: stored.scrapedStatus,
    publishedDate: stored.publishedDate,
    closingDate: stored.closingDate,
    amount: stored.amount,
    briefingSession: stored.briefingSession,
    briefingCompulsory: stored.briefingCompulsory,
    briefingDateTime: stored.briefingDateTime,
    briefingVenue: stored.briefingVenue,
  }
}

export async function getExternalDocumentsForTender(args: {
  orgId?: string | null
  tenderId: string
}) {
  const tender = await getTender({ orgId: args.orgId, tenderId: args.tenderId })
  const stored = await loadTenderScrapedSnapshot(tender.id)

  if (!stored) {
    return {
      source: inferScrapedSource(tender.source),
      items: [] as ExternalTenderDocument[],
    }
  }

  let documents = parsePersistedExternalDocumentRecords(stored.documents)
  documents = await recoverTenderExternalDocuments({
    tenderId: tender.id,
    orgId: args.orgId,
    source: stored.source ?? tender.source,
    externalId: stored.externalId ?? parseETenderIdFromSource(tender.source),
    documents,
  })

  const lifecycle = inferTenderLifecycle({
    scrapedStatus: stored.scrapedStatus,
    closingDate: stored.closingDate,
  })

  if (lifecycle !== "open" && documents.some((doc) => !doc.archivedStorageKey)) {
    const archived = await archiveExternalTenderDocuments({
      tenderId: tender.id,
      documents,
    })
    if (archived.changed) {
      documents = archived.documents
      await persistTenderExternalDocuments({
        tenderId: tender.id,
        orgId: args.orgId,
        documents,
      })
    }
  }

  const items = mapPersistedExternalDocumentsToClient(tender.id, documents)

  return {
    source: inferScrapedSource(stored.source),
    items,
  }
}

export async function downloadExternalDocumentForTender(args: {
  orgId?: string | null
  tenderId: string
  documentId: string
}) {
  const tender = await getTender({ orgId: args.orgId, tenderId: args.tenderId })
  const stored = await loadTenderScrapedSnapshot(tender.id)
  const documents = parsePersistedExternalDocumentRecords(stored?.documents)
  const doc = documents.find((item) => item.id === args.documentId)

  if (!doc || !doc.archivedStorageKey) {
    throw new AppError("NOT_FOUND", "Archived external document not found", 404)
  }

  const content = await storage().getObject({ key: doc.archivedStorageKey })
  return {
    content,
    mimeType: doc.archivedMimeType || mimeFromFilename(doc.name) || "application/octet-stream",
    filename: deriveDisplayFilename({
      originalFilename: doc.name,
      storageKey: doc.archivedStorageKey,
      mimeType: doc.archivedMimeType,
    }),
  }
}

export async function getTenderOutcomeInsights(args: {
  orgId: string
  userId: string
  tenderId: string
}): Promise<TenderOutcomeInsights> {
  const tender = await getTender({ orgId: args.orgId, tenderId: args.tenderId })
  const lifecycleState = await loadTenderLifecycleState(tender.id)
  const companyName = lifecycleState.scraped?.companyName ?? tender.companyName ?? null
  const category = lifecycleState.scraped?.category ?? tender.category ?? null
  const effectiveClosingDate =
    lifecycleState.scraped?.closingDate ?? tender.closingDate ?? null
  const lifecycleDateLabel = inferLifecycleDateLabel(
    lifecycleState.lifecycle,
    lifecycleState.lifecycleDateSource,
  )
  const watched = Boolean(
    await prisma.watchlistItem.findFirst({
      where: {
        orgId: args.orgId,
        userId: args.userId,
        tenderId: args.tenderId,
      },
      select: { id: true },
    }),
  )

  const [buyerTenderCount, buyerAwardedCount, buyerCancelledCount, categoryTenderCount] =
    await Promise.all([
      companyName
        ? prisma.tender.count({
            where: {
              AND: [accessibleTenderWhere(args.orgId), { companyName }],
            },
          })
        : Promise.resolve(0),
      companyName
        ? prisma.tender.count({
            where: {
              AND: [
                accessibleTenderWhere(args.orgId),
                {
                  companyName,
                  scrapedStatus: { contains: "award", mode: "insensitive" },
                },
              ],
            },
          })
        : Promise.resolve(0),
      companyName
        ? prisma.tender.count({
            where: {
              AND: [
                accessibleTenderWhere(args.orgId),
                {
                  companyName,
                  scrapedStatus: { contains: "cancel", mode: "insensitive" },
                },
              ],
            },
          })
        : Promise.resolve(0),
      category
        ? prisma.tender.count({
            where: {
              AND: [accessibleTenderWhere(args.orgId), { category }],
            },
          })
        : Promise.resolve(0),
    ])

  const relatedFilters = [
    companyName ? ({ companyName } as Prisma.TenderWhereInput) : null,
    category ? ({ category } as Prisma.TenderWhereInput) : null,
  ].filter((item): item is Prisma.TenderWhereInput => item !== null)
  const relatedWhere: Prisma.TenderWhereInput | null =
    relatedFilters.length > 0
      ? {
          AND: [
            accessibleTenderWhere(args.orgId),
            { id: { not: tender.id } },
            { OR: relatedFilters },
          ],
        }
      : null

  const relatedRows = relatedWhere
    ? await prisma.tender.findMany({
        where: relatedWhere,
        select: {
          id: true,
          title: true,
          companyName: true,
          closingDate: true,
          amount: true,
          scrapedStatus: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 24,
      })
    : []

  const relatedMapped = relatedRows.map((row) => {
    const lifecycle = inferTenderLifecycle({
      scrapedStatus: row.scrapedStatus,
      closingDate: row.closingDate,
    })
    return {
      id: row.id,
      title: row.title,
      companyName: row.companyName ?? null,
      closingDate: row.closingDate ?? null,
      amount: row.amount ?? null,
      lifecycle,
    }
  })

  const similarTenders = relatedMapped
    .filter((row) => {
      if (lifecycleState.lifecycle === "awarded") return row.lifecycle === "awarded"
      return row.lifecycle !== "open"
    })
    .slice(0, 4)
    .map((row) => ({
      ...row,
      reason: row.companyName && companyName && row.companyName === companyName
        ? "Same buyer"
        : category
          ? "Same category"
          : "Related recent tender",
    }))

  const reissueCandidates =
    lifecycleState.lifecycle === "cancelled" || lifecycleState.lifecycle === "closed"
      ? relatedMapped
          .filter(
            (row) =>
              row.lifecycle === "open" &&
              (hasTitleOverlap(tender.title, row.title) ||
                (companyName && row.companyName === companyName)),
          )
          .slice(0, 4)
          .map((row) => ({
            ...row,
            reason: hasTitleOverlap(tender.title, row.title)
              ? "Title overlap with a live tender"
              : "Same buyer has a live tender",
          }))
      : []

  const closingAt = parseDateLike(effectiveClosingDate)
  const staleDays =
    lifecycleState.lifecycle === "closed" && closingAt
      ? Math.max(
          0,
          Math.floor((Date.now() - closingAt.getTime()) / (24 * 60 * 60 * 1000)),
        )
      : null

  const recommendedActions: OutcomeInsightAction[] = []
  if (lifecycleState.lifecycle === "awarded") {
    recommendedActions.push(
      {
        kind: "open_compare",
        label: "Compare Against Another Tender",
        href: "/compare",
        description: "Use this award as a benchmark when evaluating similar opportunities.",
      },
      {
        kind: "open_workspace",
        label: "Open Workspace",
        href: `/tenders/${tender.id}/workspace`,
        description: "Capture debrief notes and follow-up actions for the award.",
      },
    )
  }
  if (lifecycleState.lifecycle === "cancelled") {
    recommendedActions.push({
      kind: "track_reissue",
      label: reissueCandidates.length > 0 ? "Review Reissue Candidates" : "Track Reissue",
      href:
        reissueCandidates.length > 0
          ? `/tenders/${reissueCandidates[0].id}`
          : "/search",
      description:
        reissueCandidates.length > 0
          ? "A likely replacement tender is already live."
          : "Monitor the buyer and category for a republished opportunity.",
    })
  }
  if (lifecycleState.lifecycle === "closed") {
    recommendedActions.push({
      kind: "review_timeline",
      label: "Review Timeline",
      href: `/tenders/${tender.id}/timeline`,
      description: "Check whether deadlines, files, or later status changes were recorded.",
    })
  }

  let summary = ""
  if (lifecycleState.lifecycle === "awarded") {
    summary =
      buyerAwardedCount > 1
        ? `This tender is marked as awarded. The same buyer has ${buyerAwardedCount} awarded tender records in TenderLens.`
        : "This tender is marked as awarded. Review it as a benchmark for future bids."
  } else if (lifecycleState.lifecycle === "cancelled") {
    summary =
      reissueCandidates.length > 0
        ? `This tender is marked as cancelled, and ${reissueCandidates.length} likely reissue candidate${reissueCandidates.length === 1 ? "" : "s"} were found.`
        : "This tender is marked as cancelled. Watch the buyer and category for a likely republish."
  } else if (lifecycleState.lifecycle === "closed") {
    summary =
      staleDays !== null && staleDays >= 30
        ? `This tender closed ${staleDays} day(s) ago and still looks unresolved in TenderLens.`
        : "This tender is closed. Monitor it for a later award or cancellation outcome."
  } else {
    summary = "This tender is still open."
  }

  return {
    tenderId: tender.id,
    generationMode: "rules",
    lifecycle: lifecycleState.lifecycle,
    lifecycleDetectedAt: toIsoStringOrNull(lifecycleState.lifecycleDetectedAt),
    lifecycleDate: toIsoStringOrNull(lifecycleState.lifecycleDate),
    lifecycleDateSource: lifecycleState.lifecycleDateSource,
    lifecycleDateLabel,
    statusLabel: describeLifecycle(lifecycleState.lifecycle),
    summary,
    staleDays,
    watched,
    recommendedActions,
    similarTenders,
    reissueCandidates,
    stats: {
      buyerTenderCount,
      buyerAwardedCount,
      buyerCancelledCount,
      categoryTenderCount,
    },
  }
}

export async function importETenders(args: {
  orgId: string
  userId: string
  limit: number
  start: number
  status: number
  stopOnExisting?: boolean
  onProgress?: (progress: ImportETendersProgress) => void | Promise<void>
}) {
  const startedAtMs = Date.now()
  const isEverything = args.limit === -1
  const targetLimit = isEverything ? 10000 : Math.max(args.limit, 1)
  const stopOnExisting = args.stopOnExisting ?? true
  const supportsInlineScrapedColumns = await hasTenderScrapedColumns()

  let currentStart = args.start
  let totalImported = 0
  let totalSkipped = 0
  let stopTriggered = false

  const created: any[] = []
  const skippedItems: any[] = []

  while (
    (isEverything || totalImported + totalSkipped < targetLimit) &&
    !stopTriggered
  ) {
    const maxBatchSize =
      args.status === 4
        ? ETENDERS_IMPORT_CANCELLED_BATCH_SIZE
        : ETENDERS_IMPORT_BATCH_SIZE
    const batchSize = Math.min(
      maxBatchSize,
      isEverything ? 250 : targetLimit - (totalImported + totalSkipped),
    )
    if (batchSize <= 0) break

    const feed = await fetchETendersPage({
      start: currentStart,
      length: batchSize,
      status: args.status,
    })

    if (!feed.rows || feed.rows.length === 0) break

    const normalized = feed.rows
      .map((row) => {
        const title = (row.description ?? row.tender_No ?? "").trim()
        const source = `etenders:${row.id}:${row.tender_No ?? "unknown"}`
        return { row, title, source }
      })
      .filter((x) => Boolean(x.source))

    const existingRows =
      normalized.length > 0
        ? await prisma.tender.findMany({
            where: { source: { in: normalized.map((x) => x.source) } },
            select: { id: true, source: true },
          })
        : []
    const existingBySource = new Map(
      existingRows
        .map((e) => [((e.source ?? "").trim() || null) as string | null, e.id])
        .filter((entry): entry is [string, string] => Boolean(entry[0])),
    )

    for (const entry of normalized) {
      if (!isEverything && totalImported + totalSkipped >= targetLimit) break

      const row = entry.row
      const title = entry.title
      if (!title) {
        skippedItems.push({
          source: `etenders:${row.id}`,
          reason: "MISSING_TITLE",
          tenderNo: row.tender_No,
          title: "",
        })
        totalSkipped++
        continue
      }

      const source = entry.source
      const existingTenderId = existingBySource.get(source)
      if (existingTenderId) {
        const previousLifecycleState = await loadTenderLifecycleState(
          existingTenderId,
        )
        const docs = await fetchETenderDetailsDocuments(row)
        const scrapedPayload = mapRowToScrapedPayload(row, docs, args.status)
        
        await updateTenderScrapedFields({
          tenderId: existingTenderId,
          orgId: args.orgId,
          payload: scrapedPayload,
        })
        
        await maybeLogLifecycleChange({
          orgId: args.orgId,
          tenderId: existingTenderId,
          previous: {
            lifecycle: previousLifecycleState.lifecycle,
            lifecycleDetectedAt: previousLifecycleState.lifecycleDetectedAt,
            lifecycleDateSource: previousLifecycleState.lifecycleDateSource,
          },
          next: scrapedPayload,
        })

        skippedItems.push({
          source,
          reason: "UPDATED_EXISTING_STATUS",
          tenderNo: row.tender_No,
          title,
        })
        totalSkipped++

        if (stopOnExisting) {
          stopTriggered = true
          break
        }
        continue
      }

      const docs = await fetchETenderDetailsDocuments(row)
      const scrapedPayload = mapRowToScrapedPayload(row, docs, args.status)

      const tender = supportsInlineScrapedColumns
        ? await prisma.tender.create({
            data: {
              orgId: null as any,
              createdByUserId: args.userId,
              title,
              source,
              status: TenderStatus.DRAFT,
              description: row.description,
              companyName: scrapedPayload.companyName,
              category: row.category,
              province: row.province,
              closingDate: scrapedPayload.closingDate,
              amount: scrapedPayload.amount,
              externalId: scrapedPayload.externalId,
              available: scrapedPayload.available,
              tenderNumber: scrapedPayload.tenderNumber,
              tenderType: scrapedPayload.tenderType,
              eSubmission: scrapedPayload.eSubmission,
              scrapedStatus: scrapedPayload.scrapedStatus,
              publishedDate: scrapedPayload.publishedDate,
              documents: scrapedPayload.documents as any,
              lastScrapedAt: new Date(),
            },
          })
        : await prisma.tender.create({
            data: {
              orgId: null as any,
              createdByUserId: args.userId,
              title,
              source,
              status: TenderStatus.DRAFT,
              description: row.description,
              companyName: scrapedPayload.companyName,
              category: row.category,
              province: row.province,
              closingDate: scrapedPayload.closingDate,
            },
          })

      await updateTenderScrapedFields({
        tenderId: tender.id,
        orgId: args.orgId,
        payload: scrapedPayload,
      })

      created.push({
        tenderId: tender.id,
        title,
        tenderNo: row.tender_No,
        source,
        category: row.category,
        department: row.organ_of_State,
        province: row.province,
        publishedAt: row.date_Published,
        closingAt: scrapedPayload.closingDate,
        amount: scrapedPayload.amount,
      })

      totalImported++
    }

    currentStart += batchSize

    if (args.onProgress) {
      await args.onProgress({
        source: "etenders.gov.za",
        requested: args.limit,
        status: args.status,
        processed: totalImported + totalSkipped,
        imported: totalImported,
        skipped: totalSkipped,
        currentStart,
        batchSize,
        stopTriggered,
        elapsedMs: Date.now() - startedAtMs,
      })
    }

    if (feed.rows.length < batchSize) break
  }

  return {
    source: "etenders.gov.za",
    requested: args.limit,
    totalImported: created.length,
    totalSkipped: skippedItems.length,
    stopTriggered,
    items: created,
  }
}
