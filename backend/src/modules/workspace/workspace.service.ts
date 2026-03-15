import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"
import { Prisma } from "@prisma/client"

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}

export async function getOrCreateWorkspace(args: {
  orgId: string
  tenderId: string
}) {
  // Verify tender exists and is visible to this org (own or global).
  const tender = await prisma.tender.findFirst({
    where: {
      id: args.tenderId,
      OR: [{ orgId: args.orgId }, { orgId: null }],
    },
  })
  if (!tender) throw new AppError("NOT_FOUND", "Tender not found", 404)

  const workspace = await prisma.bidWorkspace.findFirst({
    where: { orgId: args.orgId, tenderId: args.tenderId },
  })

  if (workspace) return workspace

  try {
    return await prisma.bidWorkspace.create({
      data: {
        orgId: args.orgId,
        tenderId: args.tenderId,
      },
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error

    // Legacy schemas used a global unique(tenderId); fail closed to prevent cross-tenant data leaks.
    const foreignWorkspace = await prisma.bidWorkspace.findFirst({
      where: { tenderId: args.tenderId },
      select: { orgId: true },
    })

    if (foreignWorkspace && foreignWorkspace.orgId !== args.orgId) {
      throw new AppError(
        "FORBIDDEN",
        "Workspace for this tender belongs to a different organization. Apply latest migrations to enable per-org workspaces.",
        403,
      )
    }

    const currentWorkspace = await prisma.bidWorkspace.findFirst({
      where: { orgId: args.orgId, tenderId: args.tenderId },
    })
    if (currentWorkspace) return currentWorkspace

    throw error
  }
}

export async function getWorkspace(args: { orgId: string; tenderId: string }) {
  const workspace = await prisma.bidWorkspace.findFirst({
    where: { tenderId: args.tenderId, orgId: args.orgId },
    include: {
      tasks: {
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true } },
          comments: {
            orderBy: { createdAt: "asc" },
            include: { user: { select: { id: true, name: true } } },
          },
          _count: { select: { comments: true } },
        },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true } },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!workspace) {
    throw new AppError("NOT_FOUND", "Workspace not found", 404)
  }

  return workspace
}

export async function updateWorkspace(args: {
  orgId: string
  tenderId: string
  userId: string
  data: {
    decision?: string | null
    status?: string
  }
}) {
  const workspace = await getWorkspace(args) // validates existence

  const updated = await prisma.bidWorkspace.update({
    where: { id: workspace.id },
    data: {
      decision: args.data.decision,
      status: args.data.status,
    },
  })

  if (args.data.decision !== undefined && args.data.decision !== workspace.decision) {
    await logActivity({
      orgId: args.orgId,
      workspaceId: workspace.id,
      userId: args.userId,
      type: "WORKSPACE_UPDATED",
      meta: {
        field: "decision",
        from: workspace.decision,
        to: args.data.decision,
      },
    })
  }

  if (args.data.status && args.data.status !== workspace.status) {
    await logActivity({
      orgId: args.orgId,
      workspaceId: workspace.id,
      userId: args.userId,
      type: "WORKSPACE_UPDATED",
      meta: {
        field: "status",
        from: workspace.status,
        to: args.data.status,
      },
    })
  }

  return updated
}

export async function logActivity(args: {
  orgId: string
  workspaceId: string
  userId?: string
  type: string
  meta?: any
}) {
  return prisma.bidActivityLog.create({
    data: {
      orgId: args.orgId,
      workspaceId: args.workspaceId,
      userId: args.userId || "system",
      type: args.type as any,
      meta: args.meta ?? {},
    },
  })
}
