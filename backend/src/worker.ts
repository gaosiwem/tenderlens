import express from "express"
import { Worker } from "bullmq"
import { env } from "./config/env"
import {
  captureBackgroundException,
  initSentry,
  registerSentryProcessHandlers,
} from "./monitoring/sentry"
import { prisma } from "./db/prisma"
import { storage } from "./modules/storage/storage"
import type { ExtractJobPayload } from "./modules/queue/jobs"
import { JobStatus, TenderStatus } from "@prisma/client"
const { PDFParse } = require("pdf-parse")
import mammoth from "mammoth"

import { ocrImageBuffer, ocrPdfBuffer } from "./modules/ocr/ocr"
import { chunkText, normalizeText } from "./modules/text/chunker"
import { embedTexts } from "./modules/embeddings/embeddings"
import { buildBaselineInsights } from "./modules/insights/insights"
import { sha256 } from "./utils/hash"
import { emitEvent } from "./modules/notifications/notifications.service"
import { NotificationType } from "@prisma/client"

import { startDeliveryWorker } from "./workers/delivery.worker"
import { logTenderChange } from "./modules/tenders/changeLog.service"

initSentry("worker")
registerSentryProcessHandlers("worker")

async function extractTextPrimary(mimeType: string, buf: Buffer) {
  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buf })
    const out = await parser.getText()
    return {
      text: out.text ?? "",
      meta: { pageCount: out.total ?? null, mode: "pdf-parse" },
    }
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const out = await mammoth.extractRawText({ buffer: buf })
    return {
      text: out.value ?? "",
      meta: { warnings: out.messages ?? [], mode: "mammoth" },
    }
  }

  if (mimeType === "text/plain") {
    return { text: buf.toString("utf-8"), meta: { mode: "plain" } }
  }

  if (mimeType.startsWith("image/")) {
    return { text: "", meta: { mode: "image" } }
  }

  return { text: "", meta: { unsupported: true } }
}

function isWeakText(t: string) {
  const s = normalizeText(t)
  if (!s) return true
  if (s.length < 300) return true
  const letters = (s.match(/[A-Za-z]/g) ?? []).length
  return letters / Math.max(1, s.length) < 0.15
}

async function maybeOcr(mimeType: string, buf: Buffer, extractedText: string) {
  if (!env.ENABLE_OCR) return { ocrText: "", ocrMeta: null as any, pages: 0 }

  const weak = isWeakText(extractedText)
  if (!weak && !mimeType.startsWith("image/"))
    return { ocrText: "", ocrMeta: null as any, pages: 0 }

  if (mimeType.startsWith("image/")) {
    const t = await ocrImageBuffer(buf)
    return { ocrText: t, ocrMeta: { mode: "tesseract-image" }, pages: 1 }
  }

  if (mimeType === "application/pdf") {
    const out = await ocrPdfBuffer(buf)
    return {
      ocrText: out.text,
      ocrMeta: { mode: "tesseract-pdf", ocrPages: out.pages },
      pages: out.pages,
    }
  }

  return { ocrText: "", ocrMeta: null as any, pages: 0 }
}

async function extractOcr(args: {
  orgId: string
  mimeType: string
  buf: Buffer
  extractedText: string
  jobId: string
  tenderId: string
  tenderFileId: string
}) {
  if (!env.ENABLE_OCR)
    return {
      ocrText: "",
      ocrMeta: null as any,
      pages: 0,
    }

  const weak = isWeakText(args.extractedText)
  const wantsOcr = weak || args.mimeType.startsWith("image/")
  if (!wantsOcr)
    return {
      ocrText: "",
      ocrMeta: null as any,
      pages: 0,
    }

  try {
    const out = await maybeOcr(args.mimeType, args.buf, args.extractedText)
    return {
      ocrText: out.ocrText,
      ocrMeta: out.ocrMeta,
      pages: out.pages,
    }
  } catch {
    return {
      ocrText: "",
      ocrMeta: { skipped: true, reason: "ocr_error" },
      pages: 0,
    }
  }
}

async function extractEmbeddings(args: {
  orgId: string
  chunks: string[]
  tenderId: string
  tenderFileId: string
  jobId: string
}) {
  if (!env.ENABLE_EMBEDDINGS)
    return {
      embeddings: args.chunks.map(() => [] as number[]),
    }

  try {
    const embeddings = await embedTexts(args.chunks)
    return { embeddings }
  } catch {
    return {
      embeddings: args.chunks.map(() => [] as number[]),
    }
  }
}

const worker = new Worker<ExtractJobPayload>(
  "tender-extract",
  async (job) => {
    const { orgId, tenderId, tenderFileId, processingJobId } = job.data

    await prisma.processingJob.update({
      where: { id: processingJobId },
      data: {
        status: JobStatus.PROCESSING,
        attempts: { increment: 1 },
        startedAt: new Date(),
      },
    })

    await prisma.tender.update({
      where: { id: tenderId },
      data: { status: TenderStatus.PROCESSING },
    })

    const file = await prisma.tenderFile.findFirst({
      where: { id: tenderFileId, orgId },
    })
    if (!file) throw new Error("TenderFile not found")

    const buf = await storage().getObject({ key: file.storageKey })
    const primary = await extractTextPrimary(file.mimeType, buf)

    const finalRawText = normalizeText(primary.text)
    const contentHash = sha256(finalRawText)

    const prevFile = await prisma.tenderFile.findFirst({
      where: { id: tenderFileId },
      select: { contentHash: true },
    })

    // Sprint 7 Change Detection
    await prisma.tenderFile.update({
      where: { id: tenderFileId },
      data: { contentHash },
    })

    if (
      prevFile &&
      prevFile.contentHash &&
      prevFile.contentHash !== contentHash
    ) {
      await logTenderChange({
        orgId,
        tenderId,
        type: "FILE_HASH_CHANGED",
        meta: { prev: prevFile.contentHash, next: contentHash },
      })

      await emitEvent({
        orgId,
        type: NotificationType.TENDER_CHANGED,
        entityType: "Tender",
        entityId: tenderId,
        meta: { kind: "FILE_HASH_CHANGED" },
      })
    }

    const existingExtract = await prisma.tenderExtract.findFirst({
      where: { tenderFileId, orgId },
    })

    if (existingExtract && file.contentHash === contentHash) {
      // Already processed this EXACT content for this file
      await emitEvent({
        orgId,
        type: NotificationType.PROCESSING_SKIPPED,
        entityType: "TenderFile",
        entityId: tenderFileId,
        meta: { reason: "duplicate_content", contentHash },
      })

      await prisma.processingJob.update({
        where: { id: processingJobId },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          lastError: "Skipped: same contentHash",
        },
      })

      await prisma.tender.update({
        where: { id: tenderId },
        data: { status: TenderStatus.COMPLETED },
      })

      return { ok: true, skipped: true, contentHash }
    }

    // OCR
    const ocr = await extractOcr({
      orgId,
      mimeType: file.mimeType,
      buf,
      extractedText: primary.text,
      jobId: processingJobId,
      tenderId,
      tenderFileId,
    })

    const finalText = normalizeText(ocr.ocrText || primary.text)
    const meta = {
      ...primary.meta,
      ...(ocr.ocrMeta ?? {}),
      finalMode: ocr.ocrText ? "ocr" : "primary",
    }

    const extract = await prisma.tenderExtract.create({
      data: { orgId, tenderId, tenderFileId, text: finalText, meta },
    })

    const chunks = chunkText(finalText)
    const chunkContents = chunks.map((c) => c.content)

    // Embeddings
    const embed = await extractEmbeddings({
      orgId,
      chunks: chunkContents,
      tenderId,
      tenderFileId,
      jobId: processingJobId,
    })

    if (chunks.length > 0) {
      await prisma.tenderChunk.deleteMany({ where: { orgId, tenderFileId } })

      for (let i = 0; i < chunks.length; i += 1) {
        const c = chunks[i]
        const v = embed.embeddings[i] || []

        const chunkRow = await prisma.tenderChunk.create({
          data: {
            orgId,
            tenderId,
            tenderFileId,
            index: c.index,
            content: c.content,
            contentHash: c.contentHash,
            tokenCount: null,
          },
        })

        // TenderChunk.embedding is Unsupported("vector"), so Prisma create
        // inputs do not accept it. Persist via raw SQL when embeddings exist.
        if (v.length > 0 && v.every((n) => Number.isFinite(n))) {
          try {
            await prisma.$executeRawUnsafe(
              `UPDATE "TenderChunk" SET "embedding" = $1::vector WHERE "id" = $2`,
              `[${v.join(",")}]`,
              chunkRow.id,
            )
          } catch {
            // Keep chunk text even if vector persistence fails.
          }
        }
      }
    }

    const insights = buildBaselineInsights(finalText)
    await prisma.tenderInsight.create({
      data: {
        orgId,
        tenderId,
        tenderFileId,
        kind: "baseline",
        data: insights,
      },
    })

    await prisma.processingJob.update({
      where: { id: processingJobId },
      data: {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        lastError: null,
      },
    })

    await prisma.tender.update({
      where: { id: tenderId },
      data: { status: TenderStatus.COMPLETED },
    })

    return { ok: true, extractId: extract.id, chunkCount: chunks.length }
  },
  { connection: { url: env.REDIS_URL } },
)

worker.on("failed", async (job, err) => {
  try {
    if (!job) return
    const { processingJobId, tenderId } = job.data as ExtractJobPayload

    captureBackgroundException(err, {
      service: "worker",
      area: "queue",
      mechanism: "worker.failed",
      queue: "tender-extract",
      jobId: String(job.id ?? ""),
      orgId: job.data.orgId,
      tenderId,
      tenderFileId: job.data.tenderFileId,
      processingJobId,
    })

    await prisma.processingJob.update({
      where: { id: processingJobId },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        lastError: String(err?.message ?? err),
      },
    })

    await prisma.tender.update({
      where: { id: tenderId },
      data: { status: TenderStatus.FAILED },
    })
  } catch {
    // ignore
  }
})

const app = express()
app.get("/worker/health", (_req, res) => res.json({ ok: true, status: "ok" }))
app.get("/worker/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, status: "ready" })
  } catch {
    res.status(503).json({ ok: false, status: "not_ready" })
  }
})

app.listen(8090, () => {})

startDeliveryWorker()
