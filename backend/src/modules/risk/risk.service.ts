import { prisma } from "../../db/prisma"
import { AppError } from "../../utils/responses"

export async function calculateRiskScore(args: {
  orgId: string
  tenderId: string
}) {
  const [tender, workspace] = await Promise.all([
    prisma.tender.findFirst({
      where: { id: args.tenderId },
      include: { deadlines: true },
    }),
    prisma.bidWorkspace.findFirst({
      where: { tenderId: args.tenderId, orgId: args.orgId },
      include: {
        tasks: true,
        attachments: true,
      },
    }),
  ])

  if (!tender) return { score: 0, signals: [] }

  let score = 0
  const signals: string[] = []

  // 1. Time Signal (Max 35 points)
  if (tender.deadlines?.closingAt) {
    const hoursRemaining =
      (tender.deadlines.closingAt.getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursRemaining < 48) {
      score += 35
      signals.push("CRITICAL_DEADLINE_APPROACHING")
    } else if (hoursRemaining < 168) {
      score += 15
      signals.push("DEADLINE_WITHIN_ONE_WEEK")
    }
  } else {
    score += 10
    signals.push("MISSING_FINAL_DEADLINE")
  }

  // 2. Task Signal (Max 35 points)
  if (workspace) {
    const totalTasks = workspace.tasks.length
    if (totalTasks > 0) {
      const pendingTasks = workspace.tasks.filter(
        (t) => t.status !== "DONE",
      ).length
      const unassignedTasks = workspace.tasks.filter((t) => !t.ownerId).length

      const pendingRatio = pendingTasks / totalTasks
      score += Math.round(pendingRatio * 25)

      if (unassignedTasks > 0) {
        score += 10
        signals.push("UNASSIGNED_TASKS_PRESENT")
      }

      if (pendingRatio > 0.5) signals.push("HIGH_TASK_BACKLOG")
    } else {
      score += 10
      signals.push("NO_TASKS_DEFINED")
    }
  } else {
    score += 15
    signals.push("NO_WORKSPACE_INITIALIZED")
  }

  // 3. Preparation Signal (Max 30 points)
  const attachments = workspace?.attachments.length ?? 0
  if (attachments === 0) {
    score += 20
    signals.push("NO_ATTACHMENTS_UPLOADED")
  } else if (attachments < 3) {
    score += 10
    signals.push("LOW_PREPARATION_VOLUME")
  }

  // Cap at 100
  score = Math.min(100, score)

  return {
    score,
    signals,
    level: score > 70 ? "HIGH" : score > 30 ? "MEDIUM" : "LOW",
    calculatedAt: new Date(),
  }
}

export async function computeWorkspaceRisk(args: {
  orgId: string
  workspaceId: string
}) {
  const ws = await prisma.bidWorkspace.findFirst({
    where: { id: args.workspaceId, orgId: args.orgId },
  })
  if (!ws) throw new AppError("NOT_FOUND", "Workspace not found", 404)

  const risk = await calculateRiskScore({
    orgId: args.orgId,
    tenderId: ws.tenderId,
  })

  await prisma.bidWorkspace.update({
    where: { id: ws.id },
    data: {
      riskScore: risk.score,
      riskMeta: risk as any,
    },
  })

  return risk
}
