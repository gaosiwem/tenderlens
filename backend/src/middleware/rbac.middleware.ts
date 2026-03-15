import type { Request, Response, NextFunction } from "express"
import { AppError } from "../utils/responses"
import { prisma } from "../db/prisma"

const rank: Record<string, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4,
}

export function requireRole(minRole: "VIEWER" | "MEMBER" | "ADMIN" | "OWNER") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const role = req.membershipRole
    if (!role)
      return next(new AppError("FORBIDDEN", "Missing membership context", 403))
    if (rank[role] < rank[minRole])
      return next(new AppError("FORBIDDEN", "Insufficient role", 403))
    next()
  }
}

export async function requireSystemAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const userId = req.auth?.userId
  if (!userId)
    return next(new AppError("UNAUTHORIZED", "Missing auth context", 401))

  try {
    const membership = await prisma.membership.findFirst({
      where: {
        userId,
        role: "ADMIN",
        org: {
          name: "Admin Organization",
        },
      },
    })

    if (!membership) {
      return next(
        new AppError("FORBIDDEN", "System admin access required", 403),
      )
    }

    next()
  } catch (err) {
    next(err)
  }
}
