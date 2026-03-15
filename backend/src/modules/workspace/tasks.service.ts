import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"
import { BidTaskPriority, NotificationType } from "@prisma/client"
import { logActivity } from "./workspace.service"
import { emitEvent } from "../notifications/notifications.service"
import {
  enforceTaskGovernanceOnCreate,
  enforceTaskGovernanceOnStatusChange,
} from "../business/business.service"

function coerceTaskStatus(input?: string) {
  if (!input) return undefined
  const normalized = String(input).trim().toUpperCase()
  if (normalized === "REVIEW") return "BLOCKED"
  if (
    normalized === "TODO" ||
    normalized === "IN_PROGRESS" ||
    normalized === "BLOCKED" ||
    normalized === "DONE"
  ) {
    return normalized
  }
  return undefined
}

function coerceTaskPriority(input?: string) {
  if (!input) return undefined
  if (Object.values(BidTaskPriority).includes(input as BidTaskPriority)) {
    return input as BidTaskPriority
  }
  return undefined
}

export async function createTask(args: {
  workspaceId: string
  userId: string
  title: string
  description?: string
  priority?: BidTaskPriority
  status?: string
  ownerId?: string
  dueAt?: string
  tags?: string[]
}) {
  const taskWorkspace = await prisma.bidWorkspace.findUnique({
    where: { id: args.workspaceId },
  })
  if (!taskWorkspace)
    throw new AppError("NOT_FOUND", "Workspace not found", 404)

  if (args.ownerId) {
    const ownerMembership = await prisma.membership.findFirst({
      where: { orgId: taskWorkspace.orgId, userId: args.ownerId },
      select: { id: true },
    })
    if (!ownerMembership) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Owner must be a member of the organization",
        400,
      )
    }
  }

  const parsedDueAt = args.dueAt ? new Date(args.dueAt) : null
  await enforceTaskGovernanceOnCreate({
    orgId: taskWorkspace.orgId,
    ownerId: args.ownerId,
    dueAt: parsedDueAt,
  })

  const task = await prisma.bidTask.create({
    data: {
      workspaceId: args.workspaceId,
      orgId: taskWorkspace.orgId,
      createdBy: args.userId,
      title: args.title,
      description: args.description,
      priority:
        coerceTaskPriority(args.priority as unknown as string) ??
        BidTaskPriority.MEDIUM,
      ownerId: args.ownerId,
      dueAt: parsedDueAt,
      status:
        coerceTaskStatus(args.status) ?? "TODO",
      tags: Array.isArray(args.tags) ? args.tags : [],
    },
    include: { workspace: true },
  })

  const tender = await prisma.tender.findFirst({
    where: { id: task.workspace.tenderId },
    select: { orgId: true },
  })

  await logActivity({
    orgId: tender?.orgId || "system",
    workspaceId: args.workspaceId,
    userId: args.userId,
    type: "TASK_CREATED",
    meta: { taskId: task.id, title: task.title },
  })

  return task
}

export async function updateTask(args: {
  workspaceId: string
  taskId: string
  userId: string
  data: {
    title?: string
    description?: string
    status?: string
    priority?: BidTaskPriority
    ownerId?: string
    dueAt?: string | null
    tags?: string[]
  }
}) {
  const task = await prisma.bidTask.findFirst({
    where: { id: args.taskId, workspaceId: args.workspaceId },
    include: { workspace: true },
  })

  if (!task) throw new AppError("NOT_FOUND", "Task not found", 404)

  if (args.data.ownerId) {
    const ownerMembership = await prisma.membership.findFirst({
      where: { orgId: task.workspace.orgId, userId: args.data.ownerId },
      select: { id: true },
    })
    if (!ownerMembership) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Owner must be a member of the organization",
        400,
      )
    }
  }

  const nextStatus = coerceTaskStatus(args.data.status)
  const nextOwnerId =
    args.data.ownerId !== undefined ? args.data.ownerId : task.ownerId
  const nextDueAt =
    args.data.dueAt === null
      ? null
      : args.data.dueAt
        ? new Date(args.data.dueAt)
        : task.dueAt

  await enforceTaskGovernanceOnStatusChange({
    orgId: task.workspace.orgId,
    nextStatus,
    ownerId: nextOwnerId,
    dueAt: nextDueAt,
  })

  const updated = await prisma.bidTask.update({
    where: { id: args.taskId },
    data: {
      ...args.data,
      status: nextStatus,
      priority: coerceTaskPriority(args.data.priority as unknown as string),
      dueAt:
        args.data.dueAt === null
          ? null
          : args.data.dueAt
            ? new Date(args.data.dueAt)
            : undefined,
      ownerId: args.data.ownerId,
      tags: Array.isArray(args.data.tags) ? args.data.tags : undefined,
    },
    include: { owner: true, workspace: true },
  })

  // Log specific changes
  const changes: Record<string, { from: any; to: any }> = {}
  if (args.data.title && args.data.title !== task.title)
    changes.title = { from: task.title, to: args.data.title }
  if (args.data.status && args.data.status !== task.status)
    changes.status = { from: task.status, to: args.data.status }
  if (args.data.priority && args.data.priority !== task.priority)
    changes.priority = { from: task.priority, to: args.data.priority }
  if (args.data.ownerId !== undefined && args.data.ownerId !== task.ownerId)
    changes.ownerId = { from: task.ownerId, to: args.data.ownerId }
  if (args.data.tags !== undefined)
    changes.tags = { from: task.tags, to: args.data.tags }

  // For due date, comparison depends on type

  const ownerChanged =
    args.data.ownerId !== undefined && args.data.ownerId !== task.ownerId
  const statusChanged = nextStatus !== undefined && nextStatus !== task.status

  await logActivity({
    orgId: task.workspace.orgId,
    workspaceId: args.workspaceId,
    userId: args.userId,
    type: ownerChanged
      ? "TASK_ASSIGNED"
      : statusChanged
        ? "TASK_STATUS_CHANGED"
        : "TASK_UPDATED",
    meta: {
      taskId: task.id,
      before: {
        ownerId: task.ownerId,
        status: task.status,
      },
      after: {
        ownerId: updated.ownerId,
        status: updated.status,
      },
      patch: args.data,
      changes,
    },
  })

  if (ownerChanged && updated.ownerId && updated.ownerId !== args.userId) {
    const fireAt = new Date()
    try {
      await prisma.taskReminderLog.create({
        data: {
          orgId: task.workspace.orgId,
          taskId: task.id,
          userId: updated.ownerId,
          type: "ASSIGNED",
          fireAt,
        },
      })
    } catch {
      // ignore duplicate reminder logs
    }

    await emitEvent({
      orgId: task.workspace.orgId,
      type: NotificationType.ALERT_FIRED,
      entityType: "BidTask",
      entityId: task.id,
      meta: {
        kind: "TASK_ASSIGNED",
        toUserId: updated.ownerId,
        fromUserId: args.userId,
      },
    })
  }

  return updated
}

export async function listTasks(args: { workspaceId: string }) {
  return prisma.bidTask.findMany({
    where: { workspaceId: args.workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      creator: { select: { id: true, name: true } },
      workspace: true,
      _count: { select: { comments: true } },
    },
  })
}

export async function addComment(args: {
  orgId: string
  tenderId: string
  taskId: string
  userId: string
  content: string
}) {
  const task = await prisma.bidTask.findFirst({
    where: {
      id: args.taskId,
      orgId: args.orgId,
      workspace: { tenderId: args.tenderId },
    },
    include: { workspace: true },
  })
  if (!task) throw new AppError("NOT_FOUND", "Task not found", 404)

  const comment = await prisma.bidTaskComment.create({
    data: {
      orgId: task.workspace.orgId,
      taskId: args.taskId,
      userId: args.userId,
      body: args.content,
    },
  })

  await logActivity({
    orgId: task.workspace.orgId,
    workspaceId: task.workspaceId,
    userId: args.userId,
    type: "COMMENT_ADDED",
    meta: { taskId: task.id, commentId: comment.id },
  })

  return comment
}
