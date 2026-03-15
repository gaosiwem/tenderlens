import type { Request } from "express"
import { prisma } from "../../db/prisma"

export async function auditLog(args: {
  req: Request
  action: string
  orgId?: string | null
  userId?: string | null
  entityType?: string
  entityId?: string
  meta?: unknown
}) {
  const ip =
    args.req.header("x-forwarded-for")?.split(",")[0]?.trim() || args.req.ip
  const ua = args.req.header("user-agent") || undefined

  await prisma.auditLog.create({
    data: {
      action: args.action,
      orgId: args.orgId ?? null,
      userId: args.userId ?? null,
      entityType: args.entityType,
      entityId: args.entityId,
      meta: args.meta as any,
      ipAddress: ip,
      userAgent: ua,
    },
  })
}
