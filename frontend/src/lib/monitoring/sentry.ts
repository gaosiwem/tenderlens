import * as Sentry from "@sentry/nextjs";

type FrontendApiErrorArgs = {
  path: string;
  method?: string;
  status?: number | null;
  code?: string | null;
  requestId?: string | null;
  message: string;
};

export function captureFrontendApiError(args: FrontendApiErrorArgs) {
  const status = Number(args.status ?? 0);
  const code = String(args.code ?? "").toUpperCase();
  const shouldCapture =
    status >= 500 ||
    code === "FETCH_FAILED" ||
    code === "UPLOAD_FAILED" ||
    code === "BAD_RESPONSE_FORMAT";

  if (!shouldCapture) return;

  Sentry.withScope((scope) => {
    scope.setTag("surface", "frontend-api");
    scope.setTag("path", args.path);
    scope.setTag("method", (args.method ?? "GET").toUpperCase());

    if (status > 0) {
      scope.setTag("status", String(status));
    }

    if (code) {
      scope.setTag("code", code);
    }

    if (args.requestId) {
      scope.setTag("requestId", args.requestId);
    }

    scope.setContext("api", {
      path: args.path,
      method: (args.method ?? "GET").toUpperCase(),
      status: status || null,
      code: code || null,
    });

    Sentry.captureMessage(args.message, status >= 500 ? "error" : "warning");
  });
}
