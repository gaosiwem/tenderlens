import { Router } from "express"
import multer from "multer"
import crypto from "crypto"
import path from "path"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import { prisma } from "../../db/prisma"
import { storage } from "../storage/storage"
import { extractionQueue, enqueueExtractionJob } from "../queue/queue"
import type { ExtractJobPayload } from "../queue/jobs"
import { createProcessingJob } from "../tenders/tender.service"
import { JobStatus, TenderStatus } from "@prisma/client"
import {
  ORG_PROFILE_TENDER_SOURCE,
  ORG_PROFILE_TENDER_TITLE,
} from "./orgDocs.constants"
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

async function loadQueuedExtractionProcessingJobIds() {
  const queueJobs = await extractionQueue.getJobs(
    ["waiting", "active", "delayed"],
    0,
    500,
  )

  const bullJobIds = new Set<string>()
  const processingJobIds = new Set<string>()

  for (const queueJob of queueJobs) {
    bullJobIds.add(String(queueJob.id))
    const payload = queueJob.data as Partial<ExtractJobPayload> | undefined
    if (typeof payload?.processingJobId === "string") {
      processingJobIds.add(payload.processingJobId)
    }
  }

  return { bullJobIds, processingJobIds }
}

async function reconcileProfileProcessingJobs(args: {
  orgId: string
  activeJobs: Array<{
    id: string
    tenderId: string
    tenderFileId: string
  }>
  extractedFileIds: Set<string>
}) {
  if (args.activeJobs.length === 0) return

  const queuedJobs = await loadQueuedExtractionProcessingJobIds()

  for (const job of args.activeJobs) {
    if (args.extractedFileIds.has(job.tenderFileId)) {
      await prisma.processingJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          lastError: null,
        },
      })
      continue
    }

    const existsInQueue =
      queuedJobs.bullJobIds.has(job.id) ||
      queuedJobs.processingJobIds.has(job.id)

    if (existsInQueue) continue

    const payload: ExtractJobPayload = {
      orgId: args.orgId,
      tenderId: job.tenderId,
      tenderFileId: job.tenderFileId,
      processingJobId: job.id,
    }

    await prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: JobStatus.QUEUED,
        startedAt: null,
        completedAt: null,
        lastError: null,
      },
    })

    await enqueueExtractionJob(payload)
    queuedJobs.bullJobIds.add(job.id)
    queuedJobs.processingJobIds.add(job.id)
  }
}

async function getOrCreateProfileTender(args: { orgId: string; userId: string }) {
  const existing = await prisma.tender.findFirst({
    where: {
      orgId: args.orgId,
      source: ORG_PROFILE_TENDER_SOURCE,
    },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await prisma.tender.create({
    data: {
      orgId: args.orgId,
      createdByUserId: args.userId,
      title: ORG_PROFILE_TENDER_TITLE,
      source: ORG_PROFILE_TENDER_SOURCE,
      status: TenderStatus.DRAFT,
    },
    select: { id: true },
  })
  return created.id
}

export const orgDocsRouter = Router()

orgDocsRouter.get(
  "/files",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      const orgId = req.orgId!
      const profile = await prisma.tender.findFirst({
        where: { orgId, source: ORG_PROFILE_TENDER_SOURCE },
        select: { id: true },
      })
      if (!profile) {
        return res.json(
          ok({
            profileTenderId: null,
            ready: false,
            processing: false,
            items: [],
          }),
        )
      }

      const [items, activeJobs] = await Promise.all([
        prisma.tenderFile.findMany({
          where: { orgId, tenderId: profile.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            tenderId: true,
            originalFilename: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
        }),
        prisma.processingJob.findMany({
          where: {
            orgId,
            tenderId: profile.id,
            status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            tenderId: true,
            tenderFileId: true,
          },
        }),
      ])

      const fileIds = items.map((item) => item.id)
      const [extractFiles] =
        fileIds.length > 0
          ? await Promise.all([
              prisma.tenderExtract.findMany({
                where: {
                  orgId,
                  tenderId: profile.id,
                  tenderFileId: { in: fileIds },
                },
                select: { tenderFileId: true },
                distinct: ["tenderFileId"],
              }),
            ])
          : [[]]

      const extractedFileIds = new Set(extractFiles.map((row) => row.tenderFileId))
      await reconcileProfileProcessingJobs({
        orgId,
        activeJobs,
        extractedFileIds,
      })

      const [extractCount, activeJobCount, jobs] = await Promise.all([
        prisma.tenderExtract.count({
          where: { orgId, tenderId: profile.id },
        }),
        prisma.processingJob.count({
          where: {
            orgId,
            tenderId: profile.id,
            status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] },
          },
        }),
        fileIds.length > 0
          ? prisma.processingJob.findMany({
              where: {
                orgId,
                tenderId: profile.id,
                tenderFileId: { in: fileIds },
              },
              orderBy: { createdAt: "desc" },
              select: {
                tenderFileId: true,
                status: true,
                lastError: true,
              },
            })
          : Promise.resolve([]),
      ])

      const latestJobByFile = new Map<
        string,
        { status: JobStatus; lastError: string | null }
      >()
      for (const job of jobs) {
        if (latestJobByFile.has(job.tenderFileId)) continue
        latestJobByFile.set(job.tenderFileId, {
          status: job.status,
          lastError: job.lastError,
        })
      }

      const itemsWithStatus = items.map((item) => {
        const latestJob = latestJobByFile.get(item.id)
        const hasExtract = extractedFileIds.has(item.id)
        let status: "queued" | "processing" | "ready" | "failed" | "unknown"

        if (latestJob?.status === JobStatus.QUEUED) status = "queued"
        else if (latestJob?.status === JobStatus.PROCESSING) status = "processing"
        else if (latestJob?.status === JobStatus.FAILED) status = "failed"
        else if (hasExtract || latestJob?.status === JobStatus.COMPLETED)
          status = "ready"
        else status = "unknown"

        return {
          ...item,
          status,
          statusMessage: latestJob?.status === JobStatus.FAILED ? latestJob.lastError : null,
        }
      })

      return res.json(
        ok({
          profileTenderId: profile.id,
          ready: extractCount > 0 && activeJobCount === 0,
          processing: activeJobCount > 0,
          items: itemsWithStatus,
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

orgDocsRouter.post(
  "/files",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const orgId = req.orgId!
      const userId = req.auth!.userId
      const file = (req as any).file

      if (!file) throw new AppError("VALIDATION_ERROR", "Missing file", 400)
      const validated = validateUploadedFile({
        file,
        allowedMimeTypes: allowedMime,
        fileLabel: "Business document",
      })

      const profileTenderId = await getOrCreateProfileTender({ orgId, userId })
      const safeName = validated.safeName
      const ext = path.extname(file.originalname || "")
      const baseName = ext ? safeName.slice(0, -ext.length) : safeName
      const key = `org/${orgId}/org-profile/${crypto.randomUUID()}-${baseName}${ext}`

      const stored = await storage().putObject({
        key,
        body: file.buffer,
        mimeType: validated.mimeType,
      })

      const tenderFile = await prisma.tenderFile.create({
        data: {
          orgId,
          tenderId: profileTenderId,
          storageKey: stored.key,
          originalFilename: file.originalname,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          checksumSha256: stored.checksumSha256,
        },
      })

      const processingJob = await createProcessingJob({
        orgId,
        tenderId: profileTenderId,
        tenderFileId: tenderFile.id,
      })

      const payload: ExtractJobPayload = {
        orgId,
        tenderId: profileTenderId,
        tenderFileId: tenderFile.id,
        processingJobId: processingJob.id,
      }

      await enqueueExtractionJob(payload)

      return res.json(
        ok({
          profileTenderId,
          tenderFileId: tenderFile.id,
          processingJobId: processingJob.id,
        }),
      )
    } catch (e) {
      next(e)
    }
  },
)

orgDocsRouter.delete(
  "/files/:fileId",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      const orgId = req.orgId!
      const fileId = String(req.params.fileId || "").trim()
      if (!fileId) {
        throw new AppError("VALIDATION_ERROR", "Missing file id", 400)
      }

      const profile = await prisma.tender.findFirst({
        where: { orgId, source: ORG_PROFILE_TENDER_SOURCE },
        select: { id: true },
      })
      if (!profile) {
        throw new AppError("NOT_FOUND", "Organization profile not found", 404)
      }

      const file = await prisma.tenderFile.findFirst({
        where: { id: fileId, orgId, tenderId: profile.id },
        select: { id: true, storageKey: true },
      })
      if (!file) {
        throw new AppError("NOT_FOUND", "Business document not found", 404)
      }

      const activeJob = await prisma.processingJob.findFirst({
        where: {
          orgId,
          tenderId: profile.id,
          tenderFileId: file.id,
          status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] },
        },
        select: { id: true },
      })
      if (activeJob) {
        throw new AppError(
          "DOC_PROCESSING",
          "Document is still processing. Try deleting again shortly.",
          409,
        )
      }

      await storage().deleteObject({ key: file.storageKey })
      await prisma.tenderFile.delete({ where: { id: file.id } })

      return res.json(ok({ id: file.id, deleted: true }))
    } catch (e) {
      next(e)
    }
  },
)
