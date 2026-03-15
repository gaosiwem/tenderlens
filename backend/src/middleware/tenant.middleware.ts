import type { Request, Response, NextFunction } from "express"
import { AppError } from "../utils/responses"
import { prisma } from "../db/prisma"

export async function requireOrgMembership(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const userId = req.auth?.userId
  const orgId = req.params.orgId || req.header("x-org-id")

  if (!userId)
    return next(new AppError("UNAUTHORIZED", "Missing auth context", 401))
  if (!orgId) return next(new AppError("BAD_REQUEST", "Missing orgId", 400))

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  })

  if (!membership)
    return next(
      new AppError("FORBIDDEN", "Not a member of this organization", 403),
    )

  req.orgId = orgId
  req.membershipRole = membership.role
  next()
}

export async function optionalOrgMembership(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const userId = req.auth?.userId
  const orgId = req.params.orgId || req.header("x-org-id")

  if (!userId || !orgId) {
    next()
    return
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  })

  if (membership) {
    req.orgId = orgId
    req.membershipRole = membership.role
  }

  next()
}
