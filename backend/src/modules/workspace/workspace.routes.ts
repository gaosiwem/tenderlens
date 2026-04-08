import { Router } from "express"
import { z } from "zod"
import multer from "multer"
import crypto from "crypto"
import { requireAuth } from "../../middleware/auth.middleware"
import { requireOrgMembership } from "../../middleware/tenant.middleware"
import { requireRole } from "../../middleware/rbac.middleware"
import { ok, AppError } from "../../utils/responses"
import {
  getOrCreateWorkspace,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from "./workspace.service"
import { createTask, listTasks, updateTask, addComment } from "./tasks.service"
import { calculateRiskScore } from "../risk/risk.service"
import { storage } from "../storage/storage"
import { prisma } from "../../db/prisma"
import { handleMentions } from "../mentions/mentions.service"
import { emitEvent } from "../notifications/notifications.service"
import { NotificationType } from "@prisma/client"
import { emitWorkspace } from "../../realtime/broadcast"
import { requirePlanFeature, enforceTrial } from "../../billing/plan.middleware"
import { env } from "../../config/env"
import {
  parseAllowedMimeTypes,
  validateUploadedFile,
} from "../../utils/uploadValidation"

export const workspaceRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for attachments
})

// Workspace Initialization/Retrieval
workspaceRouter.get(
  "/:tenderId/workspace",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "workspace")

      const workspace = await getOrCreateWorkspace({
        orgId: req.orgId!,
        tenderId: req.params.tenderId,
      })
      res.json(ok(workspace))
    } catch (e) {
      next(e)
    }
  },
)

workspaceRouter.get(
  "/:tenderId/workspace/full",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "workspace")

      await getOrCreateWorkspace({
        orgId: req.orgId!,
        tenderId: req.params.tenderId,
      })

      const workspace = await getWorkspace({
        orgId: req.orgId!,
        tenderId: req.params.tenderId,
      })
      res.json(ok(workspace))
    } catch (e) {
      next(e)
    }
  },
)

workspaceRouter.patch(
  "/:tenderId/workspace",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "workspace")

      const updated = await updateWorkspace({
        orgId: req.orgId!,
        tenderId: req.params.tenderId,
        userId: req.auth!.userId,
        data: req.body,
      })

      emitWorkspace(updated.id, "workspace:updated", { workspace: updated })

      res.json(ok(updated))
    } catch (e) {
      next(e)
    }
  },
)

workspaceRouter.delete(
  "/:tenderId/workspace",
  requireAuth,
  requireOrgMembership,
  requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "workspace")

      const deleted = await deleteWorkspace({
        orgId: req.orgId!,
        tenderId: req.params.tenderId,
      })

      if (deleted.workspaceId) {
        emitWorkspace(deleted.workspaceId, "workspace:updated", {
          workspaceId: deleted.workspaceId,
          deleted: true,
        })
      }

      res.json(ok(deleted))
    } catch (e) {
      next(e)
    }
  },
)

// Task Management
workspaceRouter.get(
  "/:tenderId/workspace/tasks",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "workspace")

      const workspace = await getOrCreateWorkspace({
        orgId: req.orgId!,
        tenderId: req.params.tenderId,
      })
      const tasks = await listTasks({ workspaceId: workspace.id })
      res.json(ok({ items: tasks }))
    } catch (e) {
      next(e)
    }
  },
)

workspaceRouter.post(
  "/:tenderId/workspace/tasks",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "workspace")

      const workspace = await getOrCreateWorkspace({
        orgId: req.orgId!,
        tenderId: req.params.tenderId,
      })
      const task = await createTask({
        workspaceId: workspace.id,
        userId: req.auth!.userId,
        ...req.body,
      })
      res.json(ok(task))
    } catch (e) {
      next(e)
    }
  },
)

workspaceRouter.patch(
  "/:tenderId/workspace/tasks/:taskId",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "workspace")

      const workspace = await getOrCreateWorkspace({
        orgId: req.orgId!,
        tenderId: req.params.tenderId,
      })
      const updated = await updateTask({
        workspaceId: workspace.id,
        taskId: req.params.taskId,
        userId: req.auth!.userId,
        data: req.body,
      })
      res.json(ok(updated))
    } catch (e) {
      next(e)
    }
  },
)

workspaceRouter.post(
  "/:tenderId/workspace/tasks/:taskId/assign",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "workspace")

      const taskId = req.params.taskId
      const ownerId = String(req.body?.ownerId ?? "").trim() || null

      const task = await prisma.bidTask.findFirst({
        where: {
          id: taskId,
          workspace: { orgId: req.orgId!, tenderId: req.params.tenderId },
        },
      })
      if (!task) throw new AppError("NOT_FOUND", "Task not found", 404)

      if (ownerId) {
        const member = await prisma.membership.findFirst({
          where: { orgId: req.orgId!, userId: ownerId },
        })
        if (!member)
          throw new AppError(
            "VALIDATION_ERROR",
            "Assignee must be a member of the org",
            400,
          )
      }

      const before = { ownerId: task.ownerId }
      const updated = await prisma.bidTask.update({
        where: { id: taskId },
        data: { ownerId: ownerId },
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      })

      await prisma.bidActivityLog.create({
        data: {
          orgId: req.orgId!,
          workspaceId: task.workspaceId,
          userId: req.auth!.userId,
          type: "TASK_ASSIGNED",
          meta: { taskId: task.id, before, after: { ownerId: ownerId } },
        },
      })

      // notify assignee
      if (ownerId && ownerId !== req.auth!.userId) {
        const fireAt = new Date()
        try {
          await prisma.taskReminderLog.create({
            data: {
              orgId: req.orgId!,
              taskId: task.id,
              userId: ownerId,
              type: "ASSIGNED",
              fireAt,
            },
          })
        } catch {
          // ignore
        }

        await emitEvent({
          orgId: req.orgId!,
          type: NotificationType.ALERT_FIRED,
          entityType: "BidTask",
          entityId: task.id,
          meta: {
            kind: "TASK_ASSIGNED",
            toUserId: ownerId,
            fromUserId: req.auth!.userId,
          },
        })
      }

      emitWorkspace(task.workspaceId, "task:updated", { task: updated })

      res.json(ok(updated))
    } catch (e) {
      next(e)
    }
  },
)

workspaceRouter.post(
  "/:tenderId/workspace/tasks/:taskId/comments",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "workspace")

      const comment = await addComment({
        orgId: req.orgId!,
        tenderId: req.params.tenderId,
        taskId: req.params.taskId,
        userId: req.auth!.userId,
        content: req.body.content,
      })

      // Handle mentions
      await handleMentions({
        orgId: req.orgId!,
        taskId: req.params.taskId,
        commentId: comment.id,
        fromUserId: req.auth!.userId,
        commentBody: req.body.content,
      })

      // Get workspaceId for socket emit
      const task = await prisma.bidTask.findUnique({
        where: { id: req.params.taskId },
        select: { workspaceId: true },
      })
      if (task) {
        emitWorkspace(task.workspaceId, "task:commented", {
          taskId: req.params.taskId,
          comment,
        })
      }

      res.json(ok(comment))
    } catch (e) {
      next(e)
    }
  },
)

// Risk Scoring
workspaceRouter.get(
  "/:tenderId/workspace/risk",
  requireAuth,
  requireOrgMembership,
  requireRole("VIEWER"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "risk")

      const risk = await calculateRiskScore({
        orgId: req.orgId!,
        tenderId: req.params.tenderId,
      })
      res.json(ok(risk))
    } catch (e) {
      next(e)
    }
  },
)

// Attachments
workspaceRouter.post(
  "/:tenderId/workspace/attachments",
  requireAuth,
  requireOrgMembership,
  requireRole("MEMBER"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      await enforceTrial(req.orgId!)
      await requirePlanFeature(req.orgId!, "workspace")

      const file = (req as any).file
      if (!file) throw new AppError("VALIDATION_ERROR", "Missing file", 400)
      const validated = validateUploadedFile({
        file,
        allowedMimeTypes: parseAllowedMimeTypes(env.ATTACHMENTS_ALLOWED_MIME),
        fileLabel: "Attachment",
      })

      const workspace = await getOrCreateWorkspace({
        orgId: req.orgId!,
        tenderId: req.params.tenderId,
      })

      const safeName = validated.safeName
      const key = `org/${req.orgId}/workspace/${workspace.id}/${crypto.randomUUID()}-${safeName}`

      const stored = await storage().putObject({
        key,
        body: file.buffer,
        mimeType: validated.mimeType,
      })

      const attachment = await prisma.bidAttachment.create({
        data: {
          orgId: req.orgId!,
          workspaceId: workspace.id,
          uploadedBy: req.auth!.userId,
          storageKey: stored.key,
          filename: file.originalname,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
        },
      })

      res.json(ok(attachment))
    } catch (e) {
      next(e)
    }
  },
)
