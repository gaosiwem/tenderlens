import { prisma } from "../../db/prisma"
import {
  extractDeadlines,
  type DeadlineEnquiryContact,
} from "./deadlines.extractor"
import { emitEvent } from "../notifications/notifications.service"
import { NotificationType, type Prisma } from "@prisma/client"
import { AppError } from "../../utils/responses"
import { ORG_PROFILE_TENDER_SOURCE } from "../orgDocs/orgDocs.constants"

type ContextChunk = {
  id: string
  content: string
}

type LatestExtractRow = {
  tenderFileId: string
  text: string
  createdAt: Date
}

type DeadlineDataScope = {
  extractWhere: Prisma.TenderExtractWhereInput
  chunkWhere: Prisma.TenderChunkWhereInput
  deadlineWhere: Prisma.TenderDeadlineWhereInput
}

const DEADLINES_CONTEXT_MAX_CHARS = 120_000
const DEADLINES_EXTRACT_SEGMENT_CHARS = 3500

function buildContext(chunks: ContextChunk[], maxChars: number) {
  let used = 0
  const parts: string[] = []
  for (const c of chunks) {
    const block = `\n\n[chunk:${c.id}]\n${c.content}\n`
    if (used + block.length > maxChars) break
    parts.push(block)
    used += block.length
  }
  return parts.join("")
}

function normalizeExtractText(text: string | null | undefined) {
  return (text ?? "").replace(/\r\n/g, "\n").trim()
}

function splitTextBySize(text: string, size: number) {
  if (!text) return []
  const out: string[] = []
  for (let i = 0; i < text.length; i += size) {
    const part = text.slice(i, i + size).trim()
    if (part) out.push(part)
  }
  return out
}

async function resolveDeadlineDataScope(args: { orgId: string; tenderId: string }) {
  const tender = await prisma.tender.findFirst({
    where: {
      id: args.tenderId,
      OR: [
        {
          orgId: null,
          source: { not: ORG_PROFILE_TENDER_SOURCE },
        },
        {
          orgId: args.orgId,
          source: ORG_PROFILE_TENDER_SOURCE,
        },
      ],
    },
    select: { orgId: true },
  })

  if (!tender) throw new AppError("NOT_FOUND", "Tender not found", 404)

  return {
    extractWhere: { tenderId: args.tenderId },
    chunkWhere: { tenderId: args.tenderId },
    deadlineWhere: { tenderId: args.tenderId },
  } satisfies DeadlineDataScope
}

async function loadLatestExtractsPerFile(where: Prisma.TenderExtractWhereInput) {
  const rows = await prisma.tenderExtract.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      tenderFileId: true,
      text: true,
      createdAt: true,
    },
  })

  const latestByFile = new Map<string, LatestExtractRow>()
  for (const row of rows) {
    if (!row.tenderFileId) continue
    if (latestByFile.has(row.tenderFileId)) continue
    const normalized = normalizeExtractText(row.text)
    if (!normalized) continue
    latestByFile.set(row.tenderFileId, {
      tenderFileId: row.tenderFileId,
      text: normalized,
      createdAt: row.createdAt,
    })
  }

  return Array.from(latestByFile.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  )
}

function buildContextChunksFromExtracts(extracts: LatestExtractRow[]) {
  const chunks: ContextChunk[] = []
  for (const ex of extracts) {
    const parts = splitTextBySize(ex.text, DEADLINES_EXTRACT_SEGMENT_CHARS)
    for (let i = 0; i < parts.length; i += 1) {
      chunks.push({
        id: `${ex.tenderFileId}:${i + 1}`,
        content: parts[i],
      })
    }
  }
  return chunks
}

export function getDeadlineContactName(citations: unknown) {
  if (!citations || typeof citations !== "object") return null
  const value =
    "contactName" in (citations as Record<string, unknown>)
      ? (citations as Record<string, unknown>).contactName
      : null
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

export function getDeadlineEnquiryContacts(citations: unknown) {
  if (!citations || typeof citations !== "object") return []
  const value =
    "enquiryContacts" in (citations as Record<string, unknown>)
      ? (citations as Record<string, unknown>).enquiryContacts
      : null
  if (!Array.isArray(value)) return []

  const out: DeadlineEnquiryContact[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const role =
      typeof row.role === "string" && row.role.trim().length > 0
        ? row.role.trim()
        : null
    const name =
      typeof row.name === "string" && row.name.trim().length > 0
        ? row.name.trim()
        : null
    const email =
      typeof row.email === "string" && row.email.trim().length > 0
        ? row.email.trim()
        : null
    const phone =
      typeof row.phone === "string" && row.phone.trim().length > 0
        ? row.phone.trim()
        : null
    if (!role && !name && !email && !phone) continue
    out.push({ role, name, email, phone })
  }

  return out
}

function hasMissingContactDetails(
  deadline:
    | {
        contactEmail: string | null
        contactPhone: string | null
        citations: unknown
      }
    | null
    | undefined,
) {
  if (!deadline) return true
  const hasPrimary =
    Boolean(deadline.contactEmail) ||
    Boolean(deadline.contactPhone) ||
    Boolean(getDeadlineContactName(deadline.citations))
  if (hasPrimary) return false

  return getDeadlineEnquiryContacts(deadline.citations).length === 0
}

export async function refreshDeadlines(args: {
  orgId: string
  tenderId: string
}) {
  const scope = await resolveDeadlineDataScope(args)

  let contextChunks = buildContextChunksFromExtracts(
    await loadLatestExtractsPerFile(scope.extractWhere),
  )

  if (contextChunks.length === 0) {
    const fallbackChunks = await prisma.tenderChunk.findMany({
      where: scope.chunkWhere,
      orderBy: { index: "asc" },
      take: 80,
      select: {
        id: true,
        content: true,
      },
    })
    contextChunks = fallbackChunks
  }

  if (!contextChunks.length) {
    throw new AppError("NOT_FOUND", "No extracted text found", 404)
  }

  const ctx = buildContext(contextChunks, DEADLINES_CONTEXT_MAX_CHARS)
  const ex = await extractDeadlines({ questionContext: ctx })
  if (!ex) return null

  const prev = await prisma.tenderDeadline.findFirst({
    where: scope.deadlineWhere,
  })

  const saved = await prisma.tenderDeadline.upsert({
    where: { tenderId: args.tenderId },
    update: {
      closingAt: ex.closingAt ? new Date(ex.closingAt) : null,
      briefingAt: ex.briefingAt ? new Date(ex.briefingAt) : null,
      siteVisitAt: ex.siteVisitAt ? new Date(ex.siteVisitAt) : null,
      contactEmail: ex.contactEmail,
      contactPhone: ex.contactPhone,
      confidence: Number(ex.confidence ?? 0),
      citations: {
        citedChunkIds: ex.citedChunkIds,
        contactName: ex.contactName,
        enquiryContacts: ex.enquiryContacts,
      },
    },
    create: {
      orgId: args.orgId,
      tenderId: args.tenderId,
      closingAt: ex.closingAt ? new Date(ex.closingAt) : null,
      briefingAt: ex.briefingAt ? new Date(ex.briefingAt) : null,
      siteVisitAt: ex.siteVisitAt ? new Date(ex.siteVisitAt) : null,
      contactEmail: ex.contactEmail,
      contactPhone: ex.contactPhone,
      confidence: Number(ex.confidence ?? 0),
      citations: {
        citedChunkIds: ex.citedChunkIds,
        contactName: ex.contactName,
        enquiryContacts: ex.enquiryContacts,
      },
    },
  })

  const changed =
    (prev?.closingAt?.toISOString() ?? null) !==
      (saved.closingAt?.toISOString() ?? null) ||
    (prev?.briefingAt?.toISOString() ?? null) !==
      (saved.briefingAt?.toISOString() ?? null) ||
    (prev?.siteVisitAt?.toISOString() ?? null) !==
      (saved.siteVisitAt?.toISOString() ?? null)

  if (changed) {
    await emitEvent({
      orgId: args.orgId,
      type: NotificationType.DEADLINE_CHANGED,
      entityType: "Tender",
      entityId: args.tenderId,
      meta: {
        kind: "DEADLINE_CHANGED",
        prev: {
          closingAt: prev?.closingAt ?? null,
          briefingAt: prev?.briefingAt ?? null,
          siteVisitAt: prev?.siteVisitAt ?? null,
        },
        next: {
          closingAt: saved.closingAt ?? null,
          briefingAt: saved.briefingAt ?? null,
          siteVisitAt: saved.siteVisitAt ?? null,
        },
      },
    })
  }

  return saved
}

export async function getOrRefreshDeadlines(args: {
  orgId: string
  tenderId: string
}) {
  const scope = await resolveDeadlineDataScope(args)

  const existing = await prisma.tenderDeadline.findFirst({
    where: scope.deadlineWhere,
  })

  if (!hasMissingContactDetails(existing)) {
    return existing
  }

  try {
    return await refreshDeadlines(args)
  } catch (error) {
    if (existing) return existing
    throw error
  }
}
