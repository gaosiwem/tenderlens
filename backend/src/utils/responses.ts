export function ok<T>(data: T) {
  return { ok: true as const, data }
}

export function fail(code: string, message: string, details?: any) {
  return {
    ok: false as const,
    error: {
      code,
      message,
      ...(typeof details === "object" && details !== null
        ? details
        : { details }),
    },
  }
}

export class AppError extends Error {
  code: string
  status: number
  details?: unknown

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}
