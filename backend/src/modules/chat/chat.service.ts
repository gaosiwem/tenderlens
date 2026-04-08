import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { AppError } from "../../utils/responses"
import { embedQuery } from "../embeddings/embeddings"
import {
  retrieveTopChunks,
  retrieveTopChunksFallback,
  retrieveHybridChunks,
} from "./retrieval"
import type { RetrievedChunk } from "./retrieval"
import { generateAnswer, generateAnswerStream } from "./generation"
import { estimateChatCost } from "./cost"
import { ensureOrgBillingPolicy } from "../billing/policy.service"
import { logger } from "../../utils/logger"
import { chunkText, normalizeText } from "../text/chunker"
import { JobStatus, Prisma, TenderStatus } from "@prisma/client"
import { storage } from "../storage/storage"
import { sha256 } from "../../utils/hash"
import crypto from "crypto"
import { ocrPdfBuffer } from "../ocr/ocr"

const { PDFParse } = require("pdf-parse")
import mammoth from "mammoth"

type ExternalDoc = {
  id: string
  name: string
  path: string
}

type TenderMetadataSnapshot = {
  id: string
  orgId: string | null
  title: string
  source: string | null
  status: TenderStatus
  tenderNumber: string | null
  description: string | null
  category: string | null
  companyName: string | null
  province: string | null
  scrapedStatus: string | null
  publishedDate: string | null
  closingDate: string | null
  documents: unknown
  summary: string | null
}

type QuestionSignals = {
  terms: string[]
  wantsRequirements: boolean
  wantsPricing: boolean
  wantsDeadlines: boolean
  wantsCompliance: boolean
}

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

function taggedExternalFilename(doc: ExternalDoc) {
  return `${doc.name} [etenders:${doc.id}]`
}

const CHAT_SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
])

function mimeFromFilename(name: string) {
  const lower = name.toLowerCase().trim()
  if (lower.endsWith(".pdf")) return "application/pdf"
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  if (lower.endsWith(".txt")) return "text/plain"
  return ""
}

function pickMimeType(contentType: string | null, fileName: string) {
  const ctype = (contentType ?? "").split(";")[0]?.trim().toLowerCase()

  if (ctype && CHAT_SUPPORTED_MIME_TYPES.has(ctype)) return ctype
  return mimeFromFilename(fileName)
}

function parseExternalDocs(value: unknown): ExternalDoc[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const row = entry as Record<string, unknown>
      if (
        typeof row.id !== "string" ||
        typeof row.name !== "string" ||
        typeof row.path !== "string"
      ) {
        return null
      }
      return {
        id: row.id,
        name: row.name,
        path: row.path,
      }
    })
    .filter((x): x is ExternalDoc => x !== null)
}

async function loadTenderMetadataSnapshot(tenderId: string) {
  const rows = await prisma.$queryRaw<TenderMetadataSnapshot[]>`
    SELECT
      "id",
      "orgId",
      "title",
      "source",
      "status",
      "tenderNumber",
      "description",
      "category",
      "companyName",
      "province",
      "scrapedStatus",
      "publishedDate",
      "closingDate",
      "documents",
      (SELECT "content" FROM "TenderSummary" ts WHERE ts."tenderId" = ${tenderId} ORDER BY ts."createdAt" DESC LIMIT 1) as "summary"
    FROM "Tender"
    WHERE "id" = ${tenderId}
    LIMIT 1
  `
  return rows[0] ?? null
}

function isWeakTextForChat(input: string) {
  const t = normalizeText(input)
  if (!t) return true
  if (t.length < 300) return true
  const letters = (t.match(/[A-Za-z]/g) ?? []).length
  return letters / Math.max(1, t.length) < 0.15
}

function looksLikeHtml(buf: Buffer) {
  const head = buf.slice(0, 1024).toString("utf-8").toLowerCase()
  return (
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("<head") ||
    head.includes("<body")
  )
}

async function extractTextPrimaryForChat(mimeType: string, buf: Buffer) {
  if (mimeType === "application/pdf") {
    let parsedText = ""
    try {
      logger.info(
        `[chat:debug] PDF extraction: creating PDFParse with ${buf.length} bytes`,
      )
      const parser = new PDFParse({ data: buf })
      logger.info(`[chat:debug] PDF extraction: calling getText()...`)
      const out = await parser.getText()
      parsedText = out.text ?? ""
      logger.info(
        `[chat:debug] PDF extraction: got ${parsedText.length} chars, ${out.total} pages`,
      )
      if (isWeakTextForChat(parsedText) && env.ENABLE_OCR) {
        logger.info(
          `[chat:debug] PDF text is weak, attempting OCR fallback`,
        )
        try {
          const ocr = await ocrPdfBuffer(buf)
          return ocr.text ?? parsedText
        } catch (ocrErr) {
          logger.warn(
            { error: String(ocrErr) },
            "PDF OCR fallback failed, using parsed PDF text",
          )
          return parsedText
        }
      }
      return parsedText
    } catch (err) {
      logger.warn(
        { error: String(err) },
        "PDF text extraction failed, falling back to OCR",
      )
      if (!env.ENABLE_OCR) return ""
      try {
        const ocr = await ocrPdfBuffer(buf)
        return ocr.text ?? parsedText
      } catch (ocrErr) {
        logger.warn(
          { error: String(ocrErr) },
          "PDF OCR fallback failed after parser error",
        )
        return parsedText
      }
    }
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const out = await mammoth.extractRawText({ buffer: buf })
    return out.value ?? ""
  }

  if (mimeType === "text/plain") return buf.toString("utf-8")
  return ""
}

type ExternalHydrationSummary = {
  totalDocs: number
  importedDocs: number
  failedDocs: number
}

const GENERATED_TENDER_CONTEXT_FILENAME = "Tender Overview (generated).txt"
const EXTERNAL_DOC_FETCH_TIMEOUT_MS = parsePositiveInt(
  process.env.CHAT_EXTERNAL_DOC_FETCH_TIMEOUT_MS,
  45000,
  5000,
  180000,
)
const CHAT_FILE_INDEX_CANDIDATE_LIMIT = 6
const CHAT_EXTERNAL_DOC_INDEX_CANDIDATE_LIMIT = 5

async function isFreePlanOrg(orgId: string) {
  const sub = await prisma.orgSubscription.findUnique({
    where: { orgId },
    select: { plan: true },
  })
  return !sub || sub.plan === "TRIAL"
}

function buildQuestionSignals(question?: string): QuestionSignals {
  const q = (question ?? "").toLowerCase()
  const stop = new Set([
    "what",
    "when",
    "where",
    "which",
    "with",
    "from",
    "about",
    "this",
    "that",
    "have",
    "does",
    "must",
    "should",
    "please",
    "into",
    "your",
    "their",
    "there",
    "then",
    "than",
    "need",
    "needed",
    "requirements",
    "requirement",
  ])
  const terms = Array.from(
    new Set(
      q
        .split(/[^a-z0-9]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 4 && !stop.has(t)),
    ),
  ).slice(0, 12)

  const hasAny = (parts: string[]) => parts.some((p) => q.includes(p))
  return {
    terms,
    wantsRequirements: hasAny([
      "requirement",
      "mandatory",
      "eligib",
      "qualif",
      "compliance",
      "scope",
      "specif",
      "document",
      "submission",
      "criteria",
      "terms",
      "condition",
    ]),
    wantsPricing: hasAny([
      "price",
      "pricing",
      "cost",
      "budget",
      "boq",
      "financial",
      "rate",
      "quotation",
      "quote",
    ]),
    wantsDeadlines: hasAny([
      "deadline",
      "closing",
      "due",
      "date",
      "time",
      "briefing",
      "site visit",
      "submission date",
    ]),
    wantsCompliance: hasAny([
      "compliance",
      "certificat",
      "tax",
      "b-bbee",
      "license",
    ]),
  }
}

function hasKeyword(text: string, keywords: string[]) {
  return keywords.some((k) => text.includes(k))
}

function scoreFilenameForQuestion(name: string, signals: QuestionSignals) {
  const n = name.toLowerCase()
  let score = 0

  if (n.endsWith(".pdf")) score += 2.5
  else if (n.endsWith(".docx")) score += 2
  else if (n.endsWith(".txt")) score += 1

  const tenderCoreHints = [
    "tender",
    "rfp",
    "rfq",
    "spec",
    "scope",
    "requirement",
    "terms",
    "condition",
    "instructions",
    "document",
    "notice",
    "advert",
    "addendum",
    "annex",
  ]
  if (hasKeyword(n, tenderCoreHints)) score += 2

  const pricingHints = [
    "price",
    "pricing",
    "cost",
    "budget",
    "financial",
    "boq",
    "bill",
    "rates",
    "quote",
    "quotation",
    "xlsx",
    "xls",
    "csv",
  ]
  const deadlineHints = [
    "deadline",
    "closing",
    "due",
    "timeline",
    "schedule",
    "calendar",
  ]
  const complianceHints = [
    "compliance",
    "certificate",
    "tax",
    "license",
    "b-bbee",
    "eligib",
  ]

  if (signals.wantsRequirements) {
    if (hasKeyword(n, tenderCoreHints)) score += 3
    if (hasKeyword(n, pricingHints)) score -= 2
  }
  if (signals.wantsPricing && hasKeyword(n, pricingHints)) score += 4
  if (signals.wantsDeadlines && hasKeyword(n, deadlineHints)) score += 3
  if (signals.wantsCompliance && hasKeyword(n, complianceHints)) score += 3

  for (const term of signals.terms) {
    if (n.includes(term)) score += 1.5
  }

  return score
}

function rankCandidatesByQuestion<T>(
  items: T[],
  getName: (item: T) => string,
  question: string | undefined,
  limit: number,
) {
  if (items.length <= limit) return items
  const signals = buildQuestionSignals(question)
  const ranked = items
    .map((item, idx) => ({
      item,
      idx,
      score: scoreFilenameForQuestion(getName(item), signals),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.idx - b.idx
    })

  const top = ranked.slice(0, limit)
  const hasUsefulScore = top.some((r) => r.score > 0)
  if (!hasUsefulScore) return items.slice(0, limit)
  return top.map((r) => r.item)
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}

async function createChunkSafe(args: {
  orgId: string
  tenderId: string
  tenderFileId: string
  index: number
  content: string
  contentHash: string
}) {
  try {
    await (prisma as any).tenderChunk.create({
      data: {
        orgId: args.orgId,
        tenderId: args.tenderId,
        tenderFileId: args.tenderFileId,
        index: args.index,
        content: args.content,
        contentHash: args.contentHash,
        tokenCount: null,
      },
    })
  } catch (error) {
    console.error(
      `[createChunkSafe] ERROR for ${args.tenderFileId} idx ${args.index}:`,
      error,
    )
    if (isUniqueConstraintError(error)) return
    throw error
  }
}

export type ConversationContextProgress = {
  conversationId: string
  tenderId: string | null
  phase: "idle" | "no_documents" | "preparing" | "indexing" | "ready"
  progressPercent: number
  message: string
  stats: {
    userMessages: number
    totalFiles: number
    extractedFiles: number
    chunkedFiles: number
    activeJobs: number
    externalDocsTotal: number
    externalDocsImported: number
    externalDocsPending: number
  }
}

type LiveContextProgress = {
  orgId: string
  conversationId: string
  tenderId: string
  phase: ConversationContextProgress["phase"]
  progressPercent: number
  message: string
  updatedAtMs: number
}

const LIVE_CONTEXT_PROGRESS_TTL_MS = 2 * 60 * 1000
const liveContextProgress = new Map<string, LiveContextProgress>()
const activeContextPreparation = new Map<string, Promise<void>>()

function contextPreparationKey(orgId: string, tenderId: string) {
  return `${orgId}:${tenderId}`
}

function setLiveContextProgress(
  args: Omit<LiveContextProgress, "updatedAtMs">,
) {
  liveContextProgress.set(args.conversationId, {
    ...args,
    updatedAtMs: Date.now(),
  })
}

function getLiveContextProgress(args: {
  orgId: string
  conversationId: string
  tenderId: string
}) {
  const row = liveContextProgress.get(args.conversationId)
  if (!row) return null
  if (row.orgId !== args.orgId || row.tenderId !== args.tenderId) return null
  if (Date.now() - row.updatedAtMs > LIVE_CONTEXT_PROGRESS_TTL_MS) {
    liveContextProgress.delete(args.conversationId)
    return null
  }
  return row
}

function clearLiveContextProgress(conversationId: string) {
  liveContextProgress.delete(conversationId)
}

function isContextPreparationActive(orgId: string, tenderId: string) {
  return activeContextPreparation.has(contextPreparationKey(orgId, tenderId))
}

async function persistExtractAndChunks(args: {
  orgId: string
  tenderId: string
  tenderFileId: string
  text: string
  meta: Record<string, unknown>
}) {
  const finalText = normalizeText(args.text)
  if (!finalText) return

  const hasExtract = await prisma.tenderExtract.findFirst({
    where: {
      orgId: args.orgId,
      tenderId: args.tenderId,
      tenderFileId: args.tenderFileId,
    },
    select: { id: true },
  })

  if (!hasExtract) {
    await prisma.tenderExtract.create({
      data: {
        orgId: args.orgId,
        tenderId: args.tenderId,
        tenderFileId: args.tenderFileId,
        text: finalText,
        meta: args.meta as any,
      },
    })
  }

  const chunks = chunkText(finalText)
  if (chunks.length === 0) return

  await prisma.tenderChunk.deleteMany({
    where: {
      orgId: args.orgId,
      tenderId: args.tenderId,
      tenderFileId: args.tenderFileId,
    },
  })

  for (const chunk of chunks) {
    await createChunkSafe({
      orgId: args.orgId,
      tenderId: args.tenderId,
      tenderFileId: args.tenderFileId,
      index: chunk.index,
      content: chunk.content,
      contentHash: chunk.contentHash,
    })
  }
}

async function ensureChunksFromExtracts(args: {
  orgId: string
  tenderId: string
}) {
  const extracts = await prisma.tenderExtract.findMany({
    where: { orgId: args.orgId, tenderId: args.tenderId },
    select: {
      tenderFileId: true,
      text: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  if (extracts.length === 0) return

  const latestByFile = new Map<string, { tenderFileId: string; text: string }>()
  for (const ex of extracts) {
    if (!latestByFile.has(ex.tenderFileId)) {
      latestByFile.set(ex.tenderFileId, {
        tenderFileId: ex.tenderFileId,
        text: ex.text ?? "",
      })
    }
  }

  for (const ex of latestByFile.values()) {
    const existingFileChunks = await prisma.tenderChunk.count({
      where: {
        orgId: args.orgId,
        tenderId: args.tenderId,
        tenderFileId: ex.tenderFileId,
      },
    })
    if (existingFileChunks > 0) continue

    const chunks = chunkText(ex.text ?? "")
    if (chunks.length === 0) continue

    for (const chunk of chunks) {
      await createChunkSafe({
        orgId: args.orgId,
        tenderId: args.tenderId,
        tenderFileId: ex.tenderFileId,
        index: chunk.index,
        content: chunk.content,
        contentHash: chunk.contentHash,
      })
    }
  }
}

async function ensureChunksFromFiles(args: {
  orgId: string
  tenderId: string
  question?: string
  maxCandidates?: number
}) {
  const files = await prisma.tenderFile.findMany({
    where: { orgId: args.orgId, tenderId: args.tenderId },
    orderBy: { createdAt: "desc" },
    take: 25,
  })
  logger.info(
    `[chat:debug] ensureChunksFromFiles: ${files.length} files found for tender ${args.tenderId}`,
  )
  if (files.length === 0) return

  const chunkedFileRows = await prisma.tenderChunk.findMany({
    where: { orgId: args.orgId, tenderId: args.tenderId },
    select: { tenderFileId: true },
    distinct: ["tenderFileId"],
    take: 5000,
  })
  const chunkedFileIds = new Set(chunkedFileRows.map((r) => r.tenderFileId))
  logger.info(
    `[chat:debug] Already chunked file IDs: ${[...chunkedFileIds].join(", ") || "none"}`,
  )

  const pending = files.filter((file) => !chunkedFileIds.has(file.id))
  logger.info(`[chat:debug] Pending (unchunked) files: ${pending.length}`)
  for (const f of pending) {
    logger.info(
      `[chat:debug]   Pending: ${f.originalFilename} (${f.mimeType}) id=${f.id}`,
    )
  }
  if (pending.length === 0) return

  const candidates = pending.filter((file) => {
    const inferredMime = mimeFromFilename(file.originalFilename)
    const effectiveMime = CHAT_SUPPORTED_MIME_TYPES.has(file.mimeType)
      ? file.mimeType
      : inferredMime
    const supported = CHAT_SUPPORTED_MIME_TYPES.has(effectiveMime)
    logger.info(
      `[chat:debug]   MIME check: ${file.originalFilename} stored=${file.mimeType} inferred=${inferredMime} effective=${effectiveMime} supported=${supported}`,
    )
    return supported
  })
  if (candidates.length === 0) {
    logger.info(`[chat:debug] No supported candidates after MIME filtering`)
    return
  }

  const selected = rankCandidatesByQuestion(
    candidates,
    (file) => file.originalFilename,
    args.question,
    Math.max(1, args.maxCandidates ?? CHAT_FILE_INDEX_CANDIDATE_LIMIT),
  )
  console.log(
    `[chat:debug] ensureChunksFromFiles: selected ${selected.length} files`,
  )
  for (const file of selected) {
    const inferredMime = mimeFromFilename(file.originalFilename)
    const effectiveMime = CHAT_SUPPORTED_MIME_TYPES.has(file.mimeType)
      ? file.mimeType
      : inferredMime

    try {
      logger.info(
        `[chat:debug] Downloading file ${file.id} from storage: ${file.storageKey}`,
      )
      const buf = await storage().getObject({ key: file.storageKey })
      logger.info(
        `[chat:debug] Downloaded ${buf.length} bytes, first 10: ${buf.subarray(0, 10).toString("ascii")}`,
      )
      if (effectiveMime === "application/pdf" && looksLikeHtml(buf)) {
        logger.warn(`[chat] File ${file.id} looks like HTML, skipping as PDF`)
        continue
      }
      logger.info(`[chat:debug] Extracting text with mime=${effectiveMime}...`)
      const text = await extractTextPrimaryForChat(effectiveMime, buf)
      console.log(`[chat:debug] Extracted ${text.length} chars from ${file.id}`)
      if (text.length > 0) {
        logger.info(`[chat:debug] First 200 chars: ${text.substring(0, 200)}`)
      }
      await persistExtractAndChunks({
        orgId: args.orgId,
        tenderId: args.tenderId,
        tenderFileId: file.id,
        text,
        meta: {
          mode: "chat-file-fallback",
          sourceMimeType: file.mimeType,
          effectiveMimeType: effectiveMime,
        },
      })
      console.log(`[chat:debug] persistExtractAndChunks done for ${file.id}`)
    } catch (error) {
      console.error(`[chat:debug] Failed file indexing ${file.id}:`, error)

      const msg = error instanceof Error ? error.message : String(error)
      logger.warn(
        `[chat] Failed to build chunks from uploaded file ${file.id}: ${msg}`,
      )
      if (error instanceof Error) {
        logger.warn(`[chat:debug] Stack: ${error.stack}`)
      }
    }
  }
}

async function ensureChunksFromExternalDocs(args: {
  orgId: string
  tenderId: string
  question?: string
  maxCandidates?: number
  onProgress?: (state: {
    done: number
    total: number
    imported: number
    failed: number
  }) => void
}): Promise<ExternalHydrationSummary> {
  const summary: ExternalHydrationSummary = {
    totalDocs: 0,
    importedDocs: 0,
    failedDocs: 0,
  }

  const tenderMeta = await loadTenderMetadataSnapshot(args.tenderId)
  if (!tenderMeta?.documents) return summary

  const docs = parseExternalDocs(tenderMeta.documents)
  if (docs.length === 0) return summary
  const existingFiles = await prisma.tenderFile.findMany({
    where: { orgId: args.orgId, tenderId: args.tenderId },
    select: { originalFilename: true },
    take: 5000,
  })
  const existingNames = new Set(existingFiles.map((f) => f.originalFilename))

  const pendingDocs = docs.filter(
    (doc) => !existingNames.has(taggedExternalFilename(doc)),
  )
  if (pendingDocs.length === 0) return summary

  const selectedDocs = rankCandidatesByQuestion(
    pendingDocs,
    (doc) => doc.name,
    args.question,
    Math.max(1, args.maxCandidates ?? CHAT_EXTERNAL_DOC_INDEX_CANDIDATE_LIMIT),
  )
  summary.totalDocs = selectedDocs.length
  args.onProgress?.({
    done: 0,
    total: summary.totalDocs,
    imported: summary.importedDocs,
    failed: summary.failedDocs,
  })
  logger.info(
    `[chat] External doc indexing selection for tender ${args.tenderId}: selected ${selectedDocs.length}/${pendingDocs.length} pending doc(s)`,
  )

  const maxBytes = Math.max(1, env.MAX_UPLOAD_MB) * 1024 * 1024

  for (let idx = 0; idx < selectedDocs.length; idx += 1) {
    const doc = selectedDocs[idx]
    const taggedFilename = taggedExternalFilename(doc)

    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      EXTERNAL_DOC_FETCH_TIMEOUT_MS,
    )
    try {
      const response = await fetch(doc.path, {
        method: "GET",
        signal: controller.signal,
      })
      if (!response.ok) {
        logger.warn(
          `[chat] External doc fetch failed (${response.status}): ${doc.path}`,
        )
        summary.failedDocs += 1
        continue
      }

      const mimeType = pickMimeType(
        response.headers.get("content-type"),
        doc.name,
      )
      if (!mimeType || !CHAT_SUPPORTED_MIME_TYPES.has(mimeType)) {
        summary.failedDocs += 1
        continue
      }

      // Keep the timeout active while reading the response body too.
      const arrayBuffer = await response.arrayBuffer()
      const buf = Buffer.from(arrayBuffer)
      if (!buf.length || buf.length > maxBytes) {
        summary.failedDocs += 1
        continue
      }
      if (looksLikeHtml(buf)) {
        summary.failedDocs += 1
        logger.warn(
          `[chat] External doc appears to be HTML, skipping: ${doc.path}`,
        )
        continue
      }

      const safeName =
        doc.name.replace(/[^a-zA-Z0-9._-]/g, "_").trim() || `external-${doc.id}`
      const key = `org/${args.orgId}/tenders/${args.tenderId}/external/${crypto.randomUUID()}-${safeName}`
      const checksum = sha256(buf)
      let storageKey = key
      let persistedMimeType = mimeType
      let persistedSizeBytes = buf.length
      let persistedChecksum = checksum
      try {
        const stored = await storage().putObject({
          key,
          body: buf,
          mimeType,
        })
        storageKey = stored.key
        persistedMimeType = stored.mimeType
        persistedSizeBytes = stored.sizeBytes
        persistedChecksum = stored.checksumSha256 || checksum
      } catch (storageError) {
        // Keep extraction/indexing available even when object storage is transiently down.
        storageKey = `external-unstored://${args.tenderId}/${doc.id}`
        logger.warn(
          `[chat] External doc storage failed, continuing with text-only indexing for ${doc.id}: ${
            storageError instanceof Error
              ? storageError.message
              : String(storageError)
          }`,
        )
      }

      const file = await prisma.tenderFile.create({
        data: {
          orgId: args.orgId,
          tenderId: args.tenderId,
          storageKey,
          originalFilename: taggedFilename,
          mimeType: persistedMimeType,
          sizeBytes: persistedSizeBytes,
          checksumSha256: persistedChecksum,
        },
      })

      const text = await extractTextPrimaryForChat(mimeType, buf)
      await persistExtractAndChunks({
        orgId: args.orgId,
        tenderId: args.tenderId,
        tenderFileId: file.id,
        text,
        meta: {
          mode: "chat-external-doc-fallback",
          externalDocId: doc.id,
          externalPath: doc.path,
        },
      })
      summary.importedDocs += 1
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError"
      const msg = isTimeout
        ? `External doc timed out after ${EXTERNAL_DOC_FETCH_TIMEOUT_MS}ms (${doc.path})`
        : error instanceof Error
          ? error.message
          : String(error)
      logger.warn(`[chat] Failed to ingest external doc for chat: ${msg}`)
      summary.failedDocs += 1
    } finally {
      clearTimeout(timeout)
    }
    args.onProgress?.({
      done: idx + 1,
      total: summary.totalDocs,
      imported: summary.importedDocs,
      failed: summary.failedDocs,
    })
  }

  return summary
}

async function ensureGeneratedFallbackContext(args: {
  orgId: string
  tenderId: string
}) {
  const existingChunks = await prisma.tenderChunk.count({
    where: { orgId: args.orgId, tenderId: args.tenderId },
  })
  if (existingChunks > 0) return false

  const tender = await loadTenderMetadataSnapshot(args.tenderId)
  if (!tender) return false

  const docs = parseExternalDocs(tender.documents)
  const lines: string[] = [
    "Generated tender context (fallback).",
    "This context is based on available tender metadata because document text extraction is not ready yet.",
    "",
    `Tender title: ${tender.title}`,
    `Source: ${tender.source ?? "-"}`,
    `Tender number: ${tender.tenderNumber ?? "-"}`,
    `Description: ${tender.description ?? "-"}`,
    `Category: ${tender.category ?? "-"}`,
    `Procuring entity: ${tender.companyName ?? "-"}`,
    `Province: ${tender.province ?? "-"}`,
    `Status: ${tender.scrapedStatus ?? "-"}`,
    `Published date: ${tender.publishedDate ?? "-"}`,
    `Closing date: ${tender.closingDate ?? "-"}`,
  ]

  if (docs.length > 0) {
    lines.push("", "External documents listed:")
    for (const doc of docs.slice(0, 30)) {
      lines.push(`- ${doc.name} (${doc.path})`)
    }
  }

  const text = normalizeText(lines.join("\n"))
  if (!text) return false

  let file = await prisma.tenderFile.findFirst({
    where: {
      orgId: args.orgId,
      tenderId: args.tenderId,
      originalFilename: GENERATED_TENDER_CONTEXT_FILENAME,
    },
    select: { id: true },
  })

  if (!file) {
    file = await prisma.tenderFile.create({
      data: {
        orgId: args.orgId,
        tenderId: args.tenderId,
        storageKey: `generated://tender-overview/${args.tenderId}`,
        originalFilename: GENERATED_TENDER_CONTEXT_FILENAME,
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(text, "utf-8"),
        checksumSha256: sha256(text),
      },
      select: { id: true },
    })
  }

  await persistExtractAndChunks({
    orgId: args.orgId,
    tenderId: args.tenderId,
    tenderFileId: file.id,
    text,
    meta: { mode: "chat-generated-fallback" },
  })

  return true
}

function buildDeterministicFallbackAnswer(args: {
  question: string
  chunks: Array<{
    id: string
    tenderId: string
    tenderFileId: string
    index: number
    content: string
    score: number
  }>
}) {
  const top = args.chunks.slice(0, 3)
  const summary = top
    .map((c) => c.content.trim())
    .join("\n\n")
    .slice(0, 1800)

  return [
    "Answer: I could not reach the AI model, so this is a deterministic summary from the retrieved tender documents.",
    `Document summary: ${summary || "No indexed tender text is currently available."}`,
  ].join("\n")
}

function stripCitationSection(text: string) {
  if (!text) return ""
  let out = text.replace(/\n+\s*Citations?:\s*[\s\S]*$/i, "")
  out = out
    .split("\n")
    .filter((line) => !/\bchunk:[^\s]+/i.test(line))
    .join("\n")
  return out.trim()
}

async function buildEphemeralTenderChunks(args: {
  orgId: string
  tenderId: string
  question: string
  limit: number
}): Promise<RetrievedChunk[]> {
  const [tender, extracts, files] = await Promise.all([
    loadTenderMetadataSnapshot(args.tenderId),
    prisma.tenderExtract.findMany({
      where: { tenderId: args.tenderId },
      select: { orgId: true, tenderFileId: true, text: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.tenderFile.findMany({
      where: { tenderId: args.tenderId },
      select: { orgId: true, id: true, originalFilename: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ])

  const globalTender = tender?.orgId == null
  const scopedExtracts = globalTender
    ? extracts
    : extracts.filter((x) => x.orgId === args.orgId)
  const scopedFiles = globalTender
    ? files
    : files.filter((x) => x.orgId === args.orgId)

  const out: RetrievedChunk[] = []
  const seen = new Set<string>()
  const byFile = new Map<string, string>()
  for (const ex of scopedExtracts) {
    if (!byFile.has(ex.tenderFileId)) byFile.set(ex.tenderFileId, ex.text ?? "")
  }

  for (const [tenderFileId, text] of byFile.entries()) {
    const chunks = chunkText(text ?? "")
    for (const c of chunks.slice(0, 3)) {
      const key = `${tenderFileId}:${c.index}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        id: `ephemeral:${tenderFileId}:${c.index}`,
        tenderId: args.tenderId,
        tenderFileId,
        index: c.index,
        content: c.content,
        score: 0.25,
      })
      if (out.length >= args.limit) return out
    }
  }

  const docs = parseExternalDocs(tender?.documents)
  const lines: string[] = [
    "Tender context snapshot generated on demand.",
    `Question: ${args.question}`,
    "",
    `Tender title: ${tender?.title ?? "-"}`,
    `Source: ${tender?.source ?? "-"}`,
    `Tender status: ${tender?.status ?? "-"}`,
    `Tender number: ${tender?.tenderNumber ?? "-"}`,
    `Description: ${tender?.description ?? "-"}`,
    `Category: ${tender?.category ?? "-"}`,
    `Procuring entity: ${tender?.companyName ?? "-"}`,
    `Province: ${tender?.province ?? "-"}`,
    `Published date: ${tender?.publishedDate ?? "-"}`,
    `Closing date: ${tender?.closingDate ?? "-"}`,
  ]
  if (tender?.summary) {
    lines.push("", "--- AI Summary ---", tender.summary, "---")
  }

  if (scopedFiles.length > 0) {
    lines.push("", "Uploaded tender files:")
    for (const file of scopedFiles.slice(0, 20))
      lines.push(`- ${file.originalFilename}`)
  }

  if (docs.length > 0) {
    lines.push("", "External tender documents listed:")
    for (const doc of docs.slice(0, 30))
      lines.push(`- ${doc.name} (${doc.path})`)
  }

  const synthetic = normalizeText(lines.join("\n"))
  if (!synthetic) return []

  const fallbackChunks = chunkText(synthetic)
  for (const c of fallbackChunks.slice(0, args.limit)) {
    out.push({
      id: `ephemeral:meta:${c.index}`,
      tenderId: args.tenderId,
      tenderFileId: "ephemeral-meta",
      index: c.index,
      content: c.content,
      score: 0.2,
    })
  }
  return out
}

async function hasMissingExternalDocs(args: {
  orgId: string
  tenderId: string
}) {
  const tender = await loadTenderMetadataSnapshot(args.tenderId)
  if (!tender?.documents) return false

  const docs = parseExternalDocs(tender.documents)
  if (docs.length === 0) return false

  const whereFiles =
    tender.orgId == null
      ? { tenderId: args.tenderId }
      : { orgId: args.orgId, tenderId: args.tenderId }

  const files = await prisma.tenderFile.findMany({
    where: whereFiles,
    select: { originalFilename: true },
    take: 500,
  })
  const names = new Set(files.map((f) => f.originalFilename))
  return docs.some((doc) => !names.has(taggedExternalFilename(doc)))
}

async function hasUnchunkedFiles(args: { orgId: string; tenderId: string }) {
  const tender = await loadTenderMetadataSnapshot(args.tenderId)
  const globalTender = tender?.orgId == null
  const whereFiles = globalTender
    ? { tenderId: args.tenderId }
    : { orgId: args.orgId, tenderId: args.tenderId }

  const files = await prisma.tenderFile.findMany({
    where: whereFiles,
    select: { id: true, originalFilename: true, mimeType: true },
    take: 500,
  })
  if (files.length === 0) return false

  const candidates = files.filter((file) => {
    const inferredMime = mimeFromFilename(file.originalFilename)
    const effectiveMime = CHAT_SUPPORTED_MIME_TYPES.has(file.mimeType)
      ? file.mimeType
      : inferredMime
    return CHAT_SUPPORTED_MIME_TYPES.has(effectiveMime)
  })
  if (candidates.length === 0) return false

  const chunkedFileRows = await prisma.tenderChunk.findMany({
    where: {
      ...(globalTender ? {} : { orgId: args.orgId }),
      tenderId: args.tenderId,
      tenderFileId: { in: candidates.map((c) => c.id) },
    },
    select: { tenderFileId: true },
    distinct: ["tenderFileId"],
  })
  const chunkedFileIds = new Set(chunkedFileRows.map((r) => r.tenderFileId))

  return candidates.some((c) => !chunkedFileIds.has(c.id))
}

export async function prepareTenderContextForChat(args: {
  orgId: string
  tenderId: string
  includeExternalDocs: boolean
  question?: string
  conversationId?: string
}) {
  if (args.conversationId) {
    setLiveContextProgress({
      orgId: args.orgId,
      conversationId: args.conversationId,
      tenderId: args.tenderId,
      phase: "preparing",
      progressPercent: 5,
      message: "Reading tender context...",
    })
  }

  let externalSummary: ExternalHydrationSummary = {
    totalDocs: 0,
    importedDocs: 0,
    failedDocs: 0,
  }
  const warnings: string[] = []

  try {
    await ensureChunksFromExtracts({
      orgId: args.orgId,
      tenderId: args.tenderId,
    })
    if (args.conversationId) {
      setLiveContextProgress({
        orgId: args.orgId,
        conversationId: args.conversationId,
        tenderId: args.tenderId,
        phase: "indexing",
        progressPercent: 20,
        message: "Indexing extracted document text...",
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.warn(
      `[chat] ensureChunksFromExtracts failed for tender ${args.tenderId}: ${msg}`,
    )
    warnings.push(`extracts:${msg}`)
  }

  try {
    await ensureChunksFromFiles({
      orgId: args.orgId,
      tenderId: args.tenderId,
      question: args.question,
      maxCandidates: CHAT_FILE_INDEX_CANDIDATE_LIMIT,
    })
    if (args.conversationId) {
      setLiveContextProgress({
        orgId: args.orgId,
        conversationId: args.conversationId,
        tenderId: args.tenderId,
        phase: "indexing",
        progressPercent: 45,
        message: "Reading uploaded files for chat indexing...",
      })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.warn(
      `[chat] ensureChunksFromFiles failed for tender ${args.tenderId}: ${msg}`,
    )
    warnings.push(`files:${msg}`)
  }

  if (args.includeExternalDocs) {
    try {
      externalSummary = await ensureChunksFromExternalDocs({
        orgId: args.orgId,
        tenderId: args.tenderId,
        question: args.question,
        maxCandidates: CHAT_EXTERNAL_DOC_INDEX_CANDIDATE_LIMIT,
        onProgress: args.conversationId
          ? (state) => {
              const pct = state.total
                ? Math.min(90, 45 + Math.round((state.done / state.total) * 45))
                : 90
              setLiveContextProgress({
                orgId: args.orgId,
                conversationId: args.conversationId!,
                tenderId: args.tenderId,
                phase: "indexing",
                progressPercent: pct,
                message:
                  state.total > 0
                    ? `Importing external docs ${state.done}/${state.total}...`
                    : "Importing external documents...",
              })
            }
          : undefined,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.warn(
        `[chat] ensureChunksFromExternalDocs failed for tender ${args.tenderId}: ${msg}`,
      )
      warnings.push(`external:${msg}`)
    }
  }

  let chunkCount = 0
  try {
    chunkCount = await prisma.tenderChunk.count({
      where: { orgId: args.orgId, tenderId: args.tenderId },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.warn(
      `[chat] Failed counting chunks for tender ${args.tenderId}: ${msg}`,
    )
    warnings.push(`count:${msg}`)
  }

  if (chunkCount === 0) {
    try {
      const generated = await ensureGeneratedFallbackContext({
        orgId: args.orgId,
        tenderId: args.tenderId,
      })
      if (generated) {
        chunkCount = await prisma.tenderChunk.count({
          where: { orgId: args.orgId, tenderId: args.tenderId },
        })
        if (args.conversationId) {
          setLiveContextProgress({
            orgId: args.orgId,
            conversationId: args.conversationId,
            tenderId: args.tenderId,
            phase: "indexing",
            progressPercent: 95,
            message: "Created fallback tender context for chat.",
          })
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.warn(
        `[chat] ensureGeneratedFallbackContext failed for tender ${args.tenderId}: ${msg}`,
      )
      warnings.push(`generated:${msg}`)
    }
  }

  try {
    await reconcileTenderStatusForChat({
      orgId: args.orgId,
      tenderId: args.tenderId,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.warn(
      `[chat] reconcileTenderStatusForChat failed for tender ${args.tenderId}: ${msg}`,
    )
    warnings.push(`status:${msg}`)
  }

  if (args.conversationId) {
    setLiveContextProgress({
      orgId: args.orgId,
      conversationId: args.conversationId,
      tenderId: args.tenderId,
      phase: chunkCount > 0 ? "ready" : "indexing",
      progressPercent: chunkCount > 0 ? 100 : 95,
      message:
        chunkCount > 0
          ? "Tender documents are indexed and ready for chat."
          : "Context preparation is still in progress...",
    })
  }

  return { chunkCount, externalSummary, warnings }
}

function scheduleTenderContextPreparation(args: {
  orgId: string
  tenderId: string
  includeExternalDocs: boolean
  question?: string
  conversationId?: string
}) {
  const key = contextPreparationKey(args.orgId, args.tenderId)
  if (activeContextPreparation.has(key)) {
    if (args.conversationId) {
      setLiveContextProgress({
        orgId: args.orgId,
        conversationId: args.conversationId,
        tenderId: args.tenderId,
        phase: "indexing",
        progressPercent: 10,
        message: "Context indexing is already running in the background...",
      })
    }
    return false
  }

  const task = (async () => {
    try {
      await prepareTenderContextForChat(args)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      logger.error(
        `[chat] Background context preparation failed for tender ${args.tenderId}: ${msg}`,
      )
      if (args.conversationId) {
        setLiveContextProgress({
          orgId: args.orgId,
          conversationId: args.conversationId,
          tenderId: args.tenderId,
          phase: "indexing",
          progressPercent: 5,
          message:
            "Background context indexing hit an error; retrying on next chat.",
        })
      }
    } finally {
      activeContextPreparation.delete(key)
    }
  })()

  activeContextPreparation.set(key, task)
  void task
  return true
}

async function reconcileTenderStatusForChat(args: {
  orgId: string
  tenderId: string
}) {
  const tender = await prisma.tender.findFirst({
    where: { id: args.tenderId },
    select: { id: true, status: true },
  })
  if (!tender) return
  if (tender.status === TenderStatus.COMPLETED) return
  if (tender.status === TenderStatus.FAILED) return

  const activeJobs = await prisma.processingJob.count({
    where: {
      orgId: args.orgId,
      tenderId: args.tenderId,
      status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] },
    },
  })
  if (activeJobs > 0) return

  const chunkCount = await prisma.tenderChunk.count({
    where: { orgId: args.orgId, tenderId: args.tenderId },
  })
  if (chunkCount === 0) return

  await prisma.tender.update({
    where: { id: args.tenderId },
    data: { status: TenderStatus.COMPLETED },
  })
}

async function retrieveChunksForQuestion(args: {
  orgId: string
  question: string
  limit: number
  tenderId?: string
}) {
  const tenderScope =
    args.tenderId &&
    ((await prisma.tender.findUnique({
      where: { id: args.tenderId },
      select: { orgId: true },
    }))?.orgId == null)
      ? "global"
      : "org"

  const hasVectorRows = await prisma.$queryRawUnsafe<
    Array<{ exists: boolean }>
  >(
    args.tenderId && tenderScope === "global"
      ? `SELECT EXISTS(
           SELECT 1
           FROM "TenderChunk" c
           WHERE c."tenderId" = $1
             AND c.embedding IS NOT NULL
         ) AS "exists"`
      : args.tenderId
      ? `SELECT EXISTS(
           SELECT 1
           FROM "TenderChunk" c
           WHERE c."orgId" = $1
             AND c."tenderId" = $2
             AND c.embedding IS NOT NULL
         ) AS "exists"`
      : `SELECT EXISTS(
           SELECT 1
           FROM "TenderChunk" c
           WHERE c."orgId" = $1
             AND c.embedding IS NOT NULL
         ) AS "exists"`,
    ...(args.tenderId
      ? tenderScope === "global"
        ? [args.tenderId]
        : [args.orgId, args.tenderId]
      : [args.orgId]),
  )
  const canUseVector = Boolean(hasVectorRows?.[0]?.exists)
  let chunks: RetrievedChunk[] = []

  if (!canUseVector) {
    chunks = await retrieveTopChunksFallback({
      orgId: args.orgId,
      question: args.question,
      limit: args.limit,
      tenderId: args.tenderId,
      scope: tenderScope,
    })
  } else {
    try {
      const queryVector = await embedQuery(args.question)
      chunks = await retrieveHybridChunks({
        orgId: args.orgId,
        queryVector,
        question: args.question,
        limit: args.limit,
        tenderId: args.tenderId,
        scope: tenderScope,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown embedding error"
      logger.warn(
        `[chat] Hybrid retrieval failed, using keyword fallback: ${message}`,
      )
      chunks = await retrieveTopChunksFallback({
        orgId: args.orgId,
        question: args.question,
        limit: args.limit,
        tenderId: args.tenderId,
        scope: tenderScope,
      })
    }
  }

  // Always blend in a bit of metadata context if we have a tenderId
  if (args.tenderId) {
    const metadataChunks = await buildEphemeralTenderChunks({
      orgId: args.orgId,
      tenderId: args.tenderId,
      question: args.question,
      limit: 2, // Just top 2 metadata chunks
    })

    if (metadataChunks.length > 0) {
      // Prepend metadata chunks so they are "early" in the context
      const seen = new Set(metadataChunks.map((c) => c.id))
      const combined = [...metadataChunks]
      for (const c of chunks) {
        if (!seen.has(c.id)) {
          combined.push(c)
        }
      }
      return combined.slice(0, args.limit)
    }
  }

  return chunks
}

export async function createConversation(args: {
  orgId: string
  userId: string
  title?: string
  tenderId?: string
}) {
  return prisma.conversation.create({
    data: {
      orgId: args.orgId,
      createdBy: args.userId,
      title: args.title ?? null,
      tenderId: args.tenderId ?? null,
    },
  })
}

export async function listConversations(orgId: string) {
  const active = await prisma.message.groupBy({
    by: ["conversationId"],
    where: { orgId },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: 50,
  })

  if (active.length === 0) return []

  const orderedIds = active.map((row) => row.conversationId)
  const rows = await prisma.conversation.findMany({
    where: { orgId, id: { in: orderedIds } },
  })

  const byId = new Map(rows.map((row) => [row.id, row]))
  return orderedIds
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
}

export async function getConversation(orgId: string, id: string) {
  const c = await prisma.conversation.findFirst({ where: { id, orgId } })
  if (!c) throw new AppError("NOT_FOUND", "Conversation not found", 404)
  const messages = await prisma.message.findMany({
    where: { conversationId: id, orgId },
    orderBy: { createdAt: "asc" },
  })
  return { conversation: c, messages }
}

export async function getConversationContextProgress(args: {
  orgId: string
  conversationId: string
}): Promise<ConversationContextProgress> {
  const convo = await prisma.conversation.findFirst({
    where: { id: args.conversationId, orgId: args.orgId },
    select: { id: true, tenderId: true },
  })
  if (!convo) throw new AppError("NOT_FOUND", "Conversation not found", 404)

  if (!convo.tenderId) {
    return {
      conversationId: convo.id,
      tenderId: null,
      phase: "idle",
      progressPercent: 100,
      message: "General chat conversation is ready.",
      stats: {
        userMessages: 0,
        totalFiles: 0,
        extractedFiles: 0,
        chunkedFiles: 0,
        activeJobs: 0,
        externalDocsTotal: 0,
        externalDocsImported: 0,
        externalDocsPending: 0,
      },
    }
  }

  const tenderId = convo.tenderId

  const [userMessages, files, extractRows, chunkRows, activeJobs, scraped] =
    await Promise.all([
      prisma.message.count({
        where: {
          orgId: args.orgId,
          conversationId: args.conversationId,
          role: "user",
        },
      }),
      prisma.tenderFile.findMany({
        where: { orgId: args.orgId, tenderId },
        select: { originalFilename: true },
        take: 5000,
      }),
      prisma.tenderExtract.findMany({
        where: { orgId: args.orgId, tenderId },
        distinct: ["tenderFileId"],
        select: { tenderFileId: true },
        take: 5000,
      }),
      prisma.tenderChunk.findMany({
        where: { orgId: args.orgId, tenderId },
        distinct: ["tenderFileId"],
        select: { tenderFileId: true },
        take: 5000,
      }),
      prisma.processingJob.count({
        where: {
          orgId: args.orgId,
          tenderId,
          status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] },
        },
      }),
      prisma.$queryRaw<Array<{ documents: unknown }>>(Prisma.sql`
      SELECT "documents"
      FROM "Tender"
      WHERE "id" = ${tenderId}
      LIMIT 1
    `),
    ])

  const docs = parseExternalDocs(scraped[0]?.documents)
  const fileNames = new Set(files.map((f) => f.originalFilename))
  const externalDocsImported = docs.reduce(
    (acc, doc) => acc + (fileNames.has(taggedExternalFilename(doc)) ? 1 : 0),
    0,
  )
  const externalDocsTotal = docs.length
  const externalDocsPending = Math.max(
    0,
    externalDocsTotal - externalDocsImported,
  )
  const totalFiles = files.length
  const extractedFiles = extractRows.length
  const chunkedFiles = chunkRows.length
  const hasIndexedContext = chunkedFiles > 0

  const fileProgress =
    totalFiles > 0 ? Math.min(1, chunkedFiles / Math.max(totalFiles, 1)) : 0
  const externalProgress =
    externalDocsTotal > 0
      ? Math.min(1, externalDocsImported / externalDocsTotal)
      : 1
  const combinedProgress =
    externalDocsTotal > 0
      ? fileProgress * 0.65 + externalProgress * 0.35
      : fileProgress

  let progressPercent = Math.round(combinedProgress * 100)
  progressPercent = Math.max(0, Math.min(100, progressPercent))

  let phase: ConversationContextProgress["phase"] = "indexing"
  let message = "Preparing tender document context..."

  if (totalFiles === 0 && externalDocsTotal === 0) {
    phase = "no_documents"
    progressPercent = 0
    message = "No tender documents found to prepare for chat."
  } else if (activeJobs > 0) {
    phase = "preparing"
    if (progressPercent >= 100) progressPercent = 99
    message = "Reading and extracting tender documents..."
  } else if (hasIndexedContext) {
    phase = "ready"
    progressPercent = 100
    message = "Relevant tender context is indexed and ready for chat."
  } else {
    phase = "indexing"
    if (progressPercent >= 100) progressPercent = 99
    if (externalDocsPending > 0) {
      message = `Indexing documents and importing ${externalDocsPending} external file(s)...`
    } else {
      message = "Indexing tender documents for chat..."
    }
  }

  const live = getLiveContextProgress({
    orgId: args.orgId,
    conversationId: args.conversationId,
    tenderId,
  })
  if (live && phase !== "ready") {
    phase = live.phase
    progressPercent = Math.max(progressPercent, live.progressPercent)
    message = live.message
  }

  return {
    conversationId: convo.id,
    tenderId,
    phase,
    progressPercent,
    message,
    stats: {
      userMessages,
      totalFiles,
      extractedFiles,
      chunkedFiles,
      activeJobs,
      externalDocsTotal,
      externalDocsImported,
      externalDocsPending,
    },
  }
}

export async function postMessage(args: {
  orgId: string
  userId: string
  conversationId: string
  question: string
}) {
  if (!env.CHAT_ENABLED)
    throw new AppError("CHAT_DISABLED", "Chat is disabled", 400)

  const convo = await prisma.conversation.findFirst({
    where: { id: args.conversationId, orgId: args.orgId },
  })
  if (!convo) throw new AppError("NOT_FOUND", "Conversation not found", 404)

  const policy = await ensureOrgBillingPolicy(args.orgId)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dailyCount = await prisma.message.count({
    where: {
      orgId: args.orgId,
      role: "user",
      createdAt: { gte: today },
    },
  })

  if (dailyCount >= policy.maxChatPerDay) {
    throw new AppError(
      "CHAT_POLICY_LIMIT",
      `Daily chat limit reached (${policy.maxChatPerDay} requests/day). Please upgrade your plan or wait until tomorrow.`,
      429,
    )
  }

  const q = args.question.trim()
  if (!q) throw new AppError("VALIDATION_ERROR", "Empty question", 400)

  const convoUserMessageCount = await prisma.message.count({
    where: {
      orgId: args.orgId,
      conversationId: args.conversationId,
      role: "user",
    },
  })

  if (convo.tenderId) {
    const unchunkedFiles = await hasUnchunkedFiles({
      orgId: args.orgId,
      tenderId: convo.tenderId,
    })
    const missingExternalDocs = await hasMissingExternalDocs({
      orgId: args.orgId,
      tenderId: convo.tenderId,
    })
    const shouldPrepareContext = unchunkedFiles || missingExternalDocs

    if (shouldPrepareContext) {
      const started = scheduleTenderContextPreparation({
        orgId: args.orgId,
        tenderId: convo.tenderId,
        includeExternalDocs: missingExternalDocs,
        question: q,
        conversationId: args.conversationId,
      })
      if (started && unchunkedFiles) {
        setLiveContextProgress({
          orgId: args.orgId,
          conversationId: args.conversationId,
          tenderId: convo.tenderId,
          phase: "preparing",
          progressPercent: 8,
          message: "Starting background indexing for tender documents...",
        })
      }
    }
  }

  let chunks = await retrieveChunksForQuestion({
    orgId: args.orgId,
    question: q,
    limit: env.CHAT_MAX_INPUT_CHUNKS,
    tenderId: convo.tenderId ?? undefined,
  })

  if (chunks.length === 0 && convo.tenderId) {
    const ephemeral = await buildEphemeralTenderChunks({
      orgId: args.orgId,
      tenderId: convo.tenderId,
      question: q,
      limit: env.CHAT_MAX_INPUT_CHUNKS,
    })
    if (ephemeral.length > 0) {
      logger.warn(
        `[chat] Using ephemeral tender context fallback for tender ${convo.tenderId} (${ephemeral.length} chunks)`,
      )
      chunks = ephemeral
    }
  }

  const userMsg = await prisma.message.create({
    data: {
      orgId: args.orgId,
      conversationId: args.conversationId,
      role: "user",
      content: q,
      citations: undefined,
    },
  })

  let answer
  try {
    answer = await generateAnswer({ question: q, chunks })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.warn(
      `[chat] AI generation failed, using deterministic fallback: ${msg}`,
    )
    answer = {
      answer: buildDeterministicFallbackAnswer({
        question: q,
        chunks,
      }),
      citations: chunks.map((c) => ({
        chunkId: c.id,
        tenderId: c.tenderId,
        tenderFileId: c.tenderFileId,
        index: c.index,
        score: c.score,
      })),
      usage: undefined,
    }
  }
  const assistantAnswerText = stripCitationSection(answer.answer)

  const assistantMsg = await prisma.message.create({
    data: {
      orgId: args.orgId,
      conversationId: args.conversationId,
      role: "assistant",
      content: assistantAnswerText,
      citations: answer.citations as any, // Json type
      tokenInput: answer.usage?.inputTokens,
      tokenOutput: answer.usage?.outputTokens,
    },
  })

  await prisma.conversation.update({
    where: { id: args.conversationId },
    data: { updatedAt: new Date() },
  })
  if (
    !convo.tenderId ||
    !isContextPreparationActive(args.orgId, convo.tenderId)
  ) {
    clearLiveContextProgress(args.conversationId)
  }

  return {
    user: userMsg,
    assistant: assistantMsg,
    citations: answer.citations,
  }
}

export async function streamMessage(args: {
  orgId: string
  userId: string
  conversationId: string
  question: string
  onToken: (token: string) => void
  onDone: (data: any) => void
}) {
  const convo = await prisma.conversation.findFirst({
    where: { id: args.conversationId, orgId: args.orgId },
  })
  if (!convo) throw new AppError("NOT_FOUND", "Conversation not found", 404)

  const policy = await ensureOrgBillingPolicy(args.orgId)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dailyCount = await prisma.message.count({
    where: { orgId: args.orgId, role: "user", createdAt: { gte: today } },
  })

  if (dailyCount >= policy.maxChatPerDay) {
    throw new AppError("CHAT_POLICY_LIMIT", "Daily chat limit reached", 429)
  }

  const q = args.question.trim()

  const convoUserMessageCount = await prisma.message.count({
    where: {
      orgId: args.orgId,
      conversationId: args.conversationId,
      role: "user",
    },
  })

  if (convo.tenderId) {
    const unchunkedFiles = await hasUnchunkedFiles({
      orgId: args.orgId,
      tenderId: convo.tenderId,
    })
    const missingExternalDocs = await hasMissingExternalDocs({
      orgId: args.orgId,
      tenderId: convo.tenderId,
    })
    const shouldPrepareContext = unchunkedFiles || missingExternalDocs

    if (shouldPrepareContext) {
      const started = scheduleTenderContextPreparation({
        orgId: args.orgId,
        tenderId: convo.tenderId,
        includeExternalDocs: missingExternalDocs,
        question: q,
        conversationId: args.conversationId,
      })
      if (started && unchunkedFiles) {
        setLiveContextProgress({
          orgId: args.orgId,
          conversationId: args.conversationId,
          tenderId: convo.tenderId,
          phase: "preparing",
          progressPercent: 8,
          message: "Starting background indexing for tender documents...",
        })
      }
    }
  }

  let chunks = await retrieveChunksForQuestion({
    orgId: args.orgId,
    question: q,
    limit: env.CHAT_MAX_INPUT_CHUNKS,
    tenderId: convo.tenderId ?? undefined,
  })

  if (chunks.length === 0 && convo.tenderId) {
    const ephemeral = await buildEphemeralTenderChunks({
      orgId: args.orgId,
      tenderId: convo.tenderId,
      question: q,
      limit: env.CHAT_MAX_INPUT_CHUNKS,
    })
    if (ephemeral.length > 0) {
      logger.warn(
        `[chat] Using ephemeral tender context fallback for tender ${convo.tenderId} (${ephemeral.length} chunks)`,
      )
      chunks = ephemeral
    }
  }

  const ctxChars =
    chunks.reduce((acc, c) => acc + c.content.length, 0) + q.length
  const estimatedCost = estimateChatCost({
    inputChars: ctxChars,
    maxOutputTokens: env.CHAT_MAX_OUTPUT_TOKENS,
  })

  if (estimatedCost > policy.maxChatCost) {
    throw new AppError("CHAT_POLICY_BLOCK", "Max chat cost exceeded", 403)
  }

  const userMsg = await prisma.message.create({
    data: {
      orgId: args.orgId,
      conversationId: args.conversationId,
      role: "user",
      content: q,
    },
  })

  let fullAnswer = ""
  let usage: any = null
  try {
    const stream = generateAnswerStream({ question: q, chunks })

    for await (const part of stream) {
      if (part.type === "token") {
        const token = part.content ?? ""
        if (!token) continue
        fullAnswer += token
        args.onToken(token)
      } else if (part.type === "usage") {
        usage = part.usage
      }
    }
    fullAnswer = stripCitationSection(fullAnswer)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.warn(
      `[chat] AI stream failed, using deterministic fallback response: ${msg}`,
    )
    fullAnswer = buildDeterministicFallbackAnswer({
      question: q,
      chunks,
    })
    fullAnswer = stripCitationSection(fullAnswer)
    if (fullAnswer) args.onToken(fullAnswer)
  }

  const assistantMsg = await prisma.message.create({
    data: {
      orgId: args.orgId,
      conversationId: args.conversationId,
      role: "assistant",
      content: fullAnswer,
      citations: chunks.map((c) => ({
        chunkId: c.id,
        tenderId: c.tenderId,
        tenderFileId: c.tenderFileId,
        index: c.index,
        score: c.score,
      })) as any,
      tokenInput: usage?.inputTokens,
      tokenOutput: usage?.outputTokens,
    },
  })

  await prisma.conversation.update({
    where: { id: args.conversationId },
    data: { updatedAt: new Date() },
  })

  if (
    !convo.tenderId ||
    !isContextPreparationActive(args.orgId, convo.tenderId)
  ) {
    clearLiveContextProgress(args.conversationId)
  }

  args.onDone({
    assistantId: assistantMsg.id,
  })
}
