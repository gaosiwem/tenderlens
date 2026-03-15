import { prisma } from "../../db/prisma"
import { extractDeadlines } from "./deadlines.extractor"
import { emitEvent } from "../notifications/notifications.service"
import { NotificationType } from "@prisma/client"
import { AppError } from "../../utils/responses"
import { backfillBriefingReminderForTenderWatchers } from "../watchlist/watchlist.defaults"

function buildContext(chunks: any[], maxChars: number) {
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

export function getDeadlineContactName(citations: unknown) {
  if (!citations || typeof citations !== "object") return null
  const value =
    "contactName" in (citations as Record<string, unknown>)
      ? (citations as Record<string, unknown>).contactName
      : null
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
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
  return !deadline.contactEmail || !deadline.contactPhone || !getDeadlineContactName(deadline.citations)
}

export async function refreshDeadlines(args: {
  orgId: string
  tenderId: string
}) {
  const chunks = await prisma.tenderChunk.findMany({
    where: { orgId: args.orgId, tenderId: args.tenderId },
    orderBy: { index: "asc" },
    take: 40,
  })
  if (!chunks.length) throw new AppError("NOT_FOUND", "No chunks found", 404)

  const ctx = buildContext(chunks, 120_000)
  const ex = await extractDeadlines({ questionContext: ctx })
  if (!ex) return null

  const prev = await prisma.tenderDeadline.findFirst({
    where: { orgId: args.orgId, tenderId: args.tenderId },
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

  if (saved.briefingAt) {
    await backfillBriefingReminderForTenderWatchers(args.tenderId)
  }

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
  const existing = await prisma.tenderDeadline.findFirst({
    where: { orgId: args.orgId, tenderId: args.tenderId },
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
