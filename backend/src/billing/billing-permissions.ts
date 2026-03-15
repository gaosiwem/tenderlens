import type { Request, Response, NextFunction } from "express"
import { AppError } from "../utils/responses"
import { prisma } from "../db/prisma"
import { Role } from "@prisma/client"

/**
 * Middleware to restrict billing actions to Org Owners, Org Admins,
 * or users explicitly assigned as Billing Admins.
 */
export async function requireBillingAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const userId = req.auth?.userId
  const orgId = req.orgId // Set by requireOrgMembership

  if (!userId || !orgId) {
    return next(
      new AppError("UNAUTHORIZED", "Missing auth or org context", 401),
    )
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  })

  if (!membership) {
    return next(
      new AppError("FORBIDDEN", "Not a member of this organization", 403),
    )
  }

  const isHighRole =
    membership.role === Role.OWNER || membership.role === Role.ADMIN
  const isExplicitBillingAdmin = (membership as any).isBillingAdmin === true

  if (!isHighRole && !isExplicitBillingAdmin) {
    return next(
      new AppError("FORBIDDEN", "Billing administration rights required", 403),
    )
  }

  next()
}
