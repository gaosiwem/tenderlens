import { Router } from "express"
import multer from "multer"
import path from "path"
import fs from "fs"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import { prisma } from "../../db/prisma"
import { env } from "../../config/env"
import { enforceTrial, requirePlanFeature } from "../../billing/plan.middleware"

const uploadDir = path.join(process.cwd(), "media", "bid_attachments")
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, "_")
    cb(null, `${Date.now()}_${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: (env.ATTACHMENTS_MAX_MB || 25) * 1024 * 1024 },
})

export const attachmentsRouter = Router()

attachmentsRouter.post(
  "/workspaces/:workspaceId",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  upload.single("file"),
  async (req: any, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "workspace")

      if (!env.ATTACHMENTS_ENABLED)
        throw new AppError("DISABLED", "Attachments disabled", 400)
      const workspaceId = String(req.params.workspaceId)
      const taskId = req.body?.taskId ? String(req.body.taskId) : null

      const ws = await prisma.bidWorkspace.findFirst({
        where: { id: workspaceId, orgId: req.orgId! },
      })
      if (!ws) throw new AppError("NOT_FOUND", "Workspace not found", 404)

      const f = req.file
      if (!f) throw new AppError("VALIDATION_ERROR", "file required", 400)

      const allowed = (env.ATTACHMENTS_ALLOWED_MIME || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      if (allowed.length && !allowed.includes(f.mimetype))
        throw new AppError("VALIDATION_ERROR", "File type not allowed", 400)

      const row = await prisma.bidAttachment.create({
        data: {
          orgId: req.orgId!,
          workspaceId,
          taskId,
          targetType: taskId ? "TASK" : "WORKSPACE",
          filename: f.originalname,
          mimeType: f.mimetype,
          sizeBytes: f.size,
          storageKey: f.filename,
          url: `/media/bid_attachments/${f.filename}`,
          uploadedBy: req.auth!.userId,
        },
      })

      await prisma.bidActivityLog.create({
        data: {
          orgId: req.orgId!,
          workspaceId,
          userId: req.auth!.userId,
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
