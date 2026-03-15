import type { Request, Response, NextFunction } from "express"
import crypto from "crypto"

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const rid = req.header("x-request-id") || crypto.randomUUID()
  req.requestId = rid
  res.setHeader("x-request-id", rid)
  next()
}