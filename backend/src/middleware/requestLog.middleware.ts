import type { Request, Response, NextFunction } from "express"
import { logger } from "../utils/logger"
import { metrics } from "../utils/metrics"

export function requestLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const started = Date.now()

  res.on("finish", () => {
    const latencyMs = Date.now() - started
    const statusCode = res.statusCode

    metrics.requestCount(req.method, req.path, statusCode)
    metrics.latencyMs(req.method, req.path, latencyMs)

    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        statusCode,
        latencyMs,
        userId: req.auth?.userId ?? null,
        orgId: req.orgId ?? null
      },
      "request_complete"
    )
  })

  next()
}