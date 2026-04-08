import { Router } from "express"
import multer from "multer"
import { requireAuth } from "../../middleware/auth.middleware"
import {
  requireOrgMembership,
} from "../../middleware/tenant.middleware"
import {
  requireRole,
  requireSystemAdmin,
} from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import { requireTenderLifecycleAccess } from "../../billing/plan.middleware"
import { auditLog } from "../audit/audit.service"
import {
  listTenders,
  getTender,
  listTenderFiles,
  listTenderJobs,
  getTenderExtract,
  createProcessingJob,
  getExternalDocumentsForTender,
  downloadExternalDocumentForTender,
  getScrapedTenderDataForTender,
  importETenders,
  type ImportETendersProgress,
  deriveDisplayFilename,
  inferTenderLifecycle,
  getTenderOutcomeInsights,
} from "./tender.service"
import { storage } from "../storage/storage"
import { enqueueExtractionJob } from "../queue/queue"
import type { ExtractJobPayload } from "../queue/jobs"
import crypto from "crypto"
import { validateUploadedFile } from "../../utils/uploadValidation"

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

const allowedMime = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
])

export const tenderRouter = Router()

type TenderLifecycle = "open" | "awarded" | "closed" | "cancelled"

function inferLifecycleForAccess(args: {
  status: string | null
  closingDate: string | null
}): TenderLifecycle {
  return inferTenderLifecycle({
    scrapedStatus: args.status,
    closingDate: args.closingDate,
  })
}

async function enforceLifecycleAccessForTender(args: {
  orgId?: string | null
  tenderId: string
}) {
  if (!args.orgId) return
  const scraped = await getScrapedTenderDataForTender({
    orgId: args.orgId,
    tenderId: args.tenderId,
  })
  const lifecycle = inferLifecycleForAccess({
    status: scraped.status,
    closingDate: scraped.closingDate,
  })
  await requireTenderLifecycleAccess(args.orgId, lifecycle)
}

tenderRouter.get("/", requireAuth, requireOrgMembership, async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? "1")
    const pageSize = Math.min(100, Number(req.query.pageSize ?? "20"))
    const search = String(req.query.search ?? "")
    const sort = String(req.query.sort ?? "closingDate")
    const dir = String(req.query.dir ?? "desc")
    const includeHistorical = String(req.query.includeHistorical ?? "false")
    const lifecycle = String(req.query.lifecycle ?? "open")
    await requireTenderLifecycleAccess(req.orgId!, lifecycle)
    const out = await listTenders({
      orgId: req.orgId!,
      page,
      pageSize,
      search,
      sort,
      dir,
      includeHistorical: includeHistorical === "true",
      lifecycle,
    })
    res.json(ok({ items: out.items, page, pageSize, total: out.total }))
  } catch (e) {
    next(e)
  }
})

tenderRouter.get(
  "/:tenderId",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      await enforceLifecycleAccessForTender({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      const tender = await getTender({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      res.json(ok(tender))
    } catch (e) {
      next(e)
    }
  },
)

tenderRouter.get(
  "/:tenderId/scraped-data",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      const data = await getScrapedTenderDataForTender({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      const lifecycle = inferLifecycleForAccess({
        status: data.status,
        closingDate: data.closingDate,
      })
      await requireTenderLifecycleAccess(req.orgId!, lifecycle)
      res.json(ok(data))
    } catch (e) {
      next(e)
    }
  },
)

tenderRouter.get(
  "/:tenderId/external-documents",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      await enforceLifecycleAccessForTender({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      const out = await getExternalDocumentsForTender({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)

tenderRouter.get(
  "/:tenderId/outcome-insights",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      await enforceLifecycleAccessForTender({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      const out = await getTenderOutcomeInsights({
        orgId: req.orgId!,
        userId: req.auth!.userId,
        tenderId: req.params.tenderId,
      })
      res.json(ok(out))
    } catch (e) {
      next(e)
    }
  },
)

tenderRouter.get(
  "/:tenderId/external-documents/:documentId/download",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      await enforceLifecycleAccessForTender({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      const file = await downloadExternalDocumentForTender({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
        documentId: req.params.documentId,
      })
      const encodedName = encodeURIComponent(file.filename)
      const asciiName = file.filename.replace(/[^\x20-\x7E]/g, "_")

      res.setHeader("Content-Type", file.mimeType)
      res.setHeader("Content-Length", String(file.content.length))
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      )
      res.send(file.content)
    } catch (e) {
      next(e)
    }
  },
)

tenderRouter.get(
  "/:tenderId/files",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      await enforceLifecycleAccessForTender({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      const files = await listTenderFiles({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      res.json(ok({ items: files }))
    } catch (e) {
      next(e)
    }
  },
)

tenderRouter.get(
  "/:tenderId/files/:fileId/download",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      const orgId = req.orgId
      const tenderId = req.params.tenderId
      const fileId = req.params.fileId

      await enforceLifecycleAccessForTender({
        orgId,
        tenderId,
      })

      await getTender({ orgId, tenderId })

      const tenderFile = await (
        await import("../../db/prisma")
      ).prisma.tenderFile.findFirst({
        where: { id: fileId, orgId: orgId ?? undefined, tenderId },
      })

      if (!tenderFile) {
        throw new AppError("NOT_FOUND", "Tender file not found", 404)
      }

      const content = await storage().getObject({ key: tenderFile.storageKey })
      const downloadName = deriveDisplayFilename({
        originalFilename: tenderFile.originalFilename,
        storageKey: tenderFile.storageKey,
        mimeType: tenderFile.mimeType,
      })
      const encodedName = encodeURIComponent(downloadName)
      const asciiName = downloadName.replace(
        /[^\x20-\x7E]/g,
        "_",
      )

      res.setHeader(
        "Content-Type",
        tenderFile.mimeType || "application/octet-stream",
      )
      res.setHeader("Content-Length", String(content.length))
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      )
      res.send(content)
    } catch (e) {
      next(e)
    }
  },
)

tenderRouter.get(
  "/:tenderId/jobs",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      await enforceLifecycleAccessForTender({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      const jobs = await listTenderJobs({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      res.json(ok({ items: jobs }))
    } catch (e) {
      next(e)
    }
  },
)

tenderRouter.get(
  "/:tenderId/extract",
  requireAuth,
  requireOrgMembership,
  async (req, res, next) => {
    try {
      await enforceLifecycleAccessForTender({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      const extract = await getTenderExtract({
        orgId: req.orgId,
        tenderId: req.params.tenderId,
      })
      res.json(ok(extract))
    } catch (e) {
      next(e)
    }
  },
)

tenderRouter.post(
  "/:tenderId/files",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const tenderId = req.params.tenderId
      const orgId = req.orgId!
      const userId = req.auth!.userId

      await enforceLifecycleAccessForTender({
        orgId,
        tenderId,
      })

      const file = (req as any).file
      if (!file) throw new AppError("VALIDATION_ERROR", "Missing file", 400)
      const validated = validateUploadedFile({
        file,
        allowedMimeTypes: allowedMime,
        fileLabel: "Tender document",
      })

      await getTender({ orgId, tenderId })

      const safeName = validated.safeName
      const key = `org/${orgId}/tenders/${tenderId}/${crypto.randomUUID()}-${safeName}`

      const stored = await storage().putObject({
        key,
        body: file.buffer,
        mimeType: validated.mimeType,
      })

      const tenderFile = await (
        await import("../../db/prisma")
      ).prisma.tenderFile.create({
        data: {
          orgId,
          tenderId,
          storageKey: stored.key,
          originalFilename: file.originalname,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          checksumSha256: stored.checksumSha256,
        },
      })

      const processingJob = await createProcessingJob({
        orgId,
        tenderId,
        tenderFileId: tenderFile.id,
      })

      const payload: ExtractJobPayload = {
        orgId,
        tenderId,
        tenderFileId: tenderFile.id,
        processingJobId: processingJob.id,
      }

      await enqueueExtractionJob(payload)

      await auditLog({
        req,
        action: "TENDER_FILE_UPLOAD",
        orgId,
        userId,
        entityType: "TenderFile",
        entityId: tenderFile.id,
          meta: {
            tenderId,
            key,
            mimeType: validated.mimeType,
            sizeBytes: file.size,
          },
        })

      res.json(
        ok({ tenderFileId: tenderFile.id, processingJobId: processingJob.id }),
      )
    } catch (e) {
      next(e)
    }
  },
)

tenderRouter.post(
  "/import-etenders",
  requireAuth,
  requireSystemAdmin,
  async (req, res, next) => {
    try {
      const limit = Number(req.query.limit ?? "10")
      const start = Number(req.query.start ?? "0")
      const status = Number(req.query.status ?? "1")
      const stopOnExisting = req.query.stopOnExisting === "true"
      const stream = req.query.stream === "true"
      const orgId = req.orgId ?? req.header("x-org-id") ?? ""
      if (!orgId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Missing x-org-id header for import context",
          400,
        )
      }
      if (![1, 2, 3, 4].includes(status)) {
        throw new AppError(
          "VALIDATION_ERROR",
          "status must be one of 1 (Open), 2 (Awarded), 3 (Closed), 4 (Cancelled)",
          400,
        )
      }

      const writeSse = (event: string, data: unknown) => {
        if (res.writableEnded || res.destroyed) return
        res.write(`event: ${event}\n`)
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      if (stream) {
        res.setHeader("Content-Type", "text/event-stream")
        res.setHeader("Cache-Control", "no-cache")
        res.setHeader("Connection", "keep-alive")
      }

      if (stream) {
        writeSse("started", {
          source: "etenders.gov.za",
          requested: limit,
          status,
          imported: 0,
          skipped: 0,
          processed: 0,
          currentStart: start,
          batchSize: 0,
          stopTriggered: false,
          elapsedMs: 0,
        } satisfies ImportETendersProgress)
      }

      const out = await importETenders({
        orgId,
        userId: req.auth!.userId,
        limit,
        start,
        status,
        stopOnExisting,
        onProgress: stream
          ? (progress) => {
              writeSse("progress", progress)
            }
          : undefined,
      })

      if (stream) {
        writeSse("done", out)
        res.end()
        return
      }

      res.json(ok(out))
    } catch (e) {
      if (req.query.stream === "true" && !res.headersSent) {
        res.setHeader("Content-Type", "text/event-stream")
        res.setHeader("Cache-Control", "no-cache")
        res.setHeader("Connection", "keep-alive")
      }
      if (req.query.stream === "true") {
        const msg = e instanceof Error ? e.message : String(e)
        if (!res.writableEnded && !res.destroyed) {
          res.write(`event: error\n`)
          res.write(`data: ${JSON.stringify({ message: msg })}\n\n`)
          res.end()
        }
        return
      }
      next(e)
    }
  },
)
