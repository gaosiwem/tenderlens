import { Router } from "express"
import multer from "multer"
import path from "path"
import fs from "fs/promises"
import { existsSync } from "fs"
import crypto from "crypto"
import { requireAuth } from "../../middleware/auth.middleware"
import { ok, AppError } from "../../utils/responses"
import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { enforceTrial, requirePlanFeature } from "../../billing/plan.middleware"
import { storage } from "../storage/storage"
import {
  parseAllowedMimeTypes,
  validateUploadedFile,
} from "../../utils/uploadValidation"

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (env.ATTACHMENTS_MAX_MB || 25) * 1024 * 1024 },
})

const roleRank: Record<string, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
}

async function getWorkspaceAccess(args: {
  workspaceId: string
  userId: string
  minRole: "VIEWER" | "MEMBER" | "ADMIN" | "OWNER"
}) {
  const workspace = await prisma.bidWorkspace.findFirst({
    where: { id: args.workspaceId },
    select: { id: true, orgId: true },
  })

  if (!workspace) {
    throw new AppError("NOT_FOUND", "Workspace not found", 404)
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_orgId: {
        userId: args.userId,
        orgId: workspace.orgId,
      },
    },
  })

  if (!membership) {
    throw new AppError("FORBIDDEN", "Not a member of this organization", 403)
  }

  if (roleRank[membership.role] < roleRank[args.minRole]) {
    throw new AppError("FORBIDDEN", "Insufficient role", 403)
  }

  return { workspace, membership }
}

async function readAttachmentObject(storageKey: string) {
  try {
    return await storage().getObject({ key: storageKey })
  } catch (error) {
    const shouldTryLegacyFallback =
      !storageKey.includes("/") &&
      existsSync(path.join(process.cwd(), "media", "bid_attachments", storageKey))

    if (!shouldTryLegacyFallback) {
      throw error
    }

    const legacyPath = path.join(
      process.cwd(),
      "media",
      "bid_attachments",
      storageKey,
    )
    return fs.readFile(legacyPath)
  }
}

export const attachmentsRouter = Router()

attachmentsRouter.post(
  "/workspaces/:workspaceId",
  requireAuth,
  upload.single("file"),
  async (req: any, res, next) => {
    try {
      if (!env.ATTACHMENTS_ENABLED)
        throw new AppError("DISABLED", "Attachments disabled", 400)
      const workspaceId = String(req.params.workspaceId)
      const taskIdSource = req.body?.taskId ?? req.query?.taskId
      const taskId =
        taskIdSource && String(taskIdSource).trim()
          ? String(taskIdSource).trim()
          : null
      const userId = req.auth!.userId

      const { workspace } = await getWorkspaceAccess({
        workspaceId,
        userId,
        minRole: "MEMBER",
      })

      await enforceTrial(workspace.orgId)
      await requirePlanFeature(workspace.orgId, "workspace")

      if (taskId) {
        const task = await prisma.bidTask.findFirst({
          where: { id: taskId, workspaceId },
          select: { id: true },
        })
        if (!task) {
          throw new AppError("VALIDATION_ERROR", "Task not found", 400)
        }
      }

      const f = req.file
      if (!f) throw new AppError("VALIDATION_ERROR", "file required", 400)

      const validated = validateUploadedFile({
        file: f,
        allowedMimeTypes: parseAllowedMimeTypes(env.ATTACHMENTS_ALLOWED_MIME),
        fileLabel: "Attachment",
      })
      const safe = validated.safeName
      const key = `org/${workspace.orgId}/workspace/${workspaceId}/attachments/${crypto.randomUUID()}-${safe}`
      const stored = await storage().putObject({
        key,
        body: f.buffer,
        mimeType: validated.mimeType,
      })

      const row = await prisma.bidAttachment.create({
        data: {
          orgId: workspace.orgId,
          workspaceId,
          taskId,
          targetType: taskId ? "TASK" : "WORKSPACE",
          filename: f.originalname,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          storageKey: stored.key,
          url: null,
          uploadedBy: userId,
        },
      })

      await prisma.bidActivityLog.create({
        data: {
          orgId: workspace.orgId,
          workspaceId,
          userId,
          type: "ATTACHMENT_ADDED",
          meta: { attachmentId: row.id, taskId },
        },
      })

      res.json(ok({ attachment: row }))
    } catch (e) {
      console.error("Attachments Route Error:", e)
      next(e)
    }
  },
)

attachmentsRouter.get(
  "/:attachmentId/download",
  requireAuth,
  async (req: any, res, next) => {
    try {
      const attachmentId = String(req.params.attachmentId || "").trim()
      if (!attachmentId) {
        throw new AppError("VALIDATION_ERROR", "Attachment id required", 400)
      }

      const attachment = await prisma.bidAttachment.findFirst({
        where: { id: attachmentId },
        select: {
          id: true,
          orgId: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          storageKey: true,
        },
      })

      if (!attachment) {
        throw new AppError("NOT_FOUND", "Attachment not found", 404)
      }

      const membership = await prisma.membership.findUnique({
        where: {
          userId_orgId: {
            userId: req.auth!.userId,
            orgId: attachment.orgId,
          },
        },
      })

      if (!membership) {
        throw new AppError("FORBIDDEN", "Not a member of this organization", 403)
      }

      const content = await readAttachmentObject(attachment.storageKey)
      const encodedName = encodeURIComponent(attachment.filename)
      const asciiName = attachment.filename.replace(/[^\x20-\x7E]/g, "_")

      res.setHeader(
        "Content-Type",
        attachment.mimeType || "application/octet-stream",
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
