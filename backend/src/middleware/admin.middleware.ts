import type { Request, Response, NextFunction } from "express"
import { prisma } from "../db/prisma"
import { AppError } from "../utils/responses"

/**
 * Middleware to require that the user is a system administrator.
 * A system administrator is a user who is an ADMIN in the "Admin Organization".
 */
export async function requireSystemAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const userId = req.auth?.userId

  if (!userId) {
    return next(new AppError("UNAUTHORIZED", "Missing auth context", 401))
  }

  // Find if user has ADMIN membership in the special Admin Organization
  const adminMembership = await prisma.membership.findFirst({
    where: {
      userId,
      role: "ADMIN",
      org: {
        name: "Admin Organization",
      },
    },
  })

  if (!adminMembership) {
    return next(
      new AppError(
        "FORBIDDEN",
        "System administrator privileges required",
        403,
      ),
    )
  }

  // Populate context for downstream handlers if needed
  req.orgId = adminMembership.orgId
  req.membershipRole = "ADMIN"

  next()
}
