import type { Request, Response, NextFunction } from "express"
import { AppError, fail } from "../utils/responses"
import { logger } from "../utils/logger"
import { metrics } from "../utils/metrics"

function isDatabaseUnavailableError(err: unknown) {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : ""
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name?: unknown }).name ?? "")
      : ""
  const message = err instanceof Error ? err.message : String(err ?? "")

  if (code === "P1001" || code === "P1002" || code === "P1008") return true
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT")
    return true
  if (name === "PrismaClientInitializationError") return true
  if (message.includes("Can't reach database server")) return true
  if (message.includes("ECONNREFUSED")) return true
  if (message.includes("ECONNRESET")) return true
  if (message.includes("Database unavailable")) return true
  return false
}

function isJsonParseError(err: unknown) {
  if (!(err instanceof Error)) return false
  const status =
    err && typeof err === "object" && "status" in err
      ? Number((err as { status?: unknown }).status)
      : NaN
  const type =
    err && typeof err === "object" && "type" in err
      ? String((err as { type?: unknown }).type ?? "")
      : ""
  if (status === 400 && type === "entity.parse.failed") return true
  if (status === 400 && err.message.toLowerCase().includes("json")) return true
  return false
}

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.requestId
  const method = req.method
  const path = req.originalUrl

  if (err instanceof AppError) {
    metrics.errorCount(err.code)
    logger.warn(
      { requestId, method, path, code: err.code, status: err.status, details: err.details },
      err.message,
    )
    return res.status(err.status).json(fail(err.code, err.message, err.details))
  }

  if (isDatabaseUnavailableError(err)) {
    metrics.errorCount("NOT_READY")
    logger.warn({ requestId, method, path, err }, "Database unavailable")
    return res.status(503).json(fail("NOT_READY", "Database unavailable"))
  }

  if (isJsonParseError(err)) {
    metrics.errorCount("VALIDATION_ERROR")
    logger.warn({ requestId, method, path, err }, "Invalid JSON payload")
    return res
      .status(400)
      .json(fail("VALIDATION_ERROR", "Invalid JSON payload"))
  }

  metrics.errorCount("INTERNAL_ERROR")
  logger.error({ requestId, method, path, err }, "Unhandled error")
  return res.status(500).json(
    fail("INTERNAL_ERROR", "Something went wrong", { requestId }),
  )
}
