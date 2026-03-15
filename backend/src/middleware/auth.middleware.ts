import type { Request, Response, NextFunction } from "express"
import { AppError } from "../utils/responses"
import { verifyAccessToken } from "../utils/jwt"
import { prisma } from "../db/prisma"

export type AuthContext = {
  userId: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
      orgId?: string
      membershipRole?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER"
      requestId?: string
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization") || ""
    const token = header.startsWith("Bearer ") ? header.slice(7) : ""
    if (!token) throw new AppError("UNAUTHORIZED", "Missing access token", 401)

    const claims = verifyAccessToken(token)
    const user = await prisma.user.findUnique({ where: { id: claims.sub } })
    if (!user || !user.isActive) throw new AppError("UNAUTHORIZED", "Invalid user", 401)

    req.auth = { userId: user.id }
    next()
  } catch (err) {
    if (err instanceof AppError) {
      return next(err)
    }
    next(new AppError("UNAUTHORIZED", "Invalid or expired token", 401))
  }
}
