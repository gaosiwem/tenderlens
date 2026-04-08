import * as Sentry from "@sentry/node"
import type { Request } from "express"
import { env } from "../config/env"

let initialized = false
let processHandlersRegistered = false

function sanitizeEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request) {
    delete event.request.data

    if (event.request.headers) {
      delete event.request.headers.authorization
      delete event.request.headers.Authorization
      delete event.request.headers.cookie
      delete event.request.headers.Cookie
    }
  }

  if (event.user) {
    delete event.user.ip_address
  }

  return event
}

export function initSentry(service: "api" | "worker") {
  if (initialized) return

  Sentry.init({
    dsn: env.SENTRY_DSN,
    enabled: Boolean(env.SENTRY_DSN),
    environment: env.SENTRY_ENVIRONMENT,
    release: env.SENTRY_RELEASE || undefined,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    sendDefaultPii: false,
    beforeSend: sanitizeEvent,
    initialScope: {
      tags: { service },
    },
  })

  initialized = true
}

export function registerSentryProcessHandlers(service: "api" | "worker") {
  if (processHandlersRegistered || !env.SENTRY_DSN) return

  process.on("unhandledRejection", (reason) => {
    captureBackgroundException(reason, {
      service,
      area: "process",
      mechanism: "unhandledRejection",
    })
    void Sentry.flush(2000)
  })

  process.on("uncaughtExceptionMonitor", (error) => {
    captureBackgroundException(error, {
      service,
      area: "process",
      mechanism: "uncaughtException",
    })
    void Sentry.flush(2000)
  })

  processHandlersRegistered = true
}

type ApiCaptureArgs = {
  level?: Sentry.SeverityLevel
  code?: string
  handled?: boolean
}

export function captureApiException(
  err: unknown,
  req: Request,
  args: ApiCaptureArgs = {},
) {
  if (!env.SENTRY_DSN) return

  Sentry.withScope((scope) => {
    scope.setLevel(args.level ?? "error")
    scope.setTag("service", "api")
    scope.setTag("method", req.method)
    scope.setTag("path", req.path)

    if (args.code) {
      scope.setTag("error_code", args.code)
    }

    if (typeof args.handled === "boolean") {
      scope.setTag("handled", String(args.handled))
    }

    if (req.requestId) {
      scope.setTag("requestId", req.requestId)
    }

    if (req.orgId) {
      scope.setTag("orgId", req.orgId)
    }

    if (req.auth?.userId) {
      scope.setUser({ id: req.auth.userId })
    }

    scope.setContext("request", {
      requestId: req.requestId ?? null,
      method: req.method,
      path: req.path,
      orgId: req.orgId ?? null,
    })

    Sentry.captureException(
      err instanceof Error ? err : new Error(String(err ?? "Unknown error")),
    )
  })
}

type BackgroundCaptureArgs = {
  service: "api" | "worker"
  area: string
  mechanism?: string
  queue?: string
  jobId?: string | null
  orgId?: string | null
  tenderId?: string | null
  tenderFileId?: string | null
  processingJobId?: string | null
}

export function captureBackgroundException(
  err: unknown,
  args: BackgroundCaptureArgs,
) {
  if (!env.SENTRY_DSN) return

  Sentry.withScope((scope) => {
    scope.setTag("service", args.service)
    scope.setTag("area", args.area)

    if (args.mechanism) scope.setTag("mechanism", args.mechanism)
    if (args.queue) scope.setTag("queue", args.queue)
    if (args.jobId) scope.setTag("jobId", args.jobId)
    if (args.orgId) scope.setTag("orgId", args.orgId)
    if (args.tenderId) scope.setTag("tenderId", args.tenderId)
    if (args.tenderFileId) scope.setTag("tenderFileId", args.tenderFileId)
    if (args.processingJobId) {
      scope.setTag("processingJobId", args.processingJobId)
    }

    scope.setContext("background", {
      queue: args.queue ?? null,
      jobId: args.jobId ?? null,
      orgId: args.orgId ?? null,
      tenderId: args.tenderId ?? null,
      tenderFileId: args.tenderFileId ?? null,
      processingJobId: args.processingJobId ?? null,
      mechanism: args.mechanism ?? null,
    })

    Sentry.captureException(
      err instanceof Error ? err : new Error(String(err ?? "Unknown error")),
    )
  })
}
