import { captureFrontendApiError } from "@/lib/monitoring/sentry";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = {
  ok: false;
  error: { code: string; message: string; details?: unknown };
};
export type ApiResponse<T> = ApiOk<T> | ApiErr;

export function getUserSafeErrorMessage(args?: {
  code?: string | null;
  status?: number | null;
}) {
  const code = String(args?.code ?? "").toUpperCase();
  const status = Number(args?.status ?? 0);

  if (code === "GOOGLE_TOKEN_REJECTED") {
    return "Unable to sign in right now. Please try again shortly.";
  }

  if (code === "GOOGLE_INVALID_PAYLOAD") {
    return "Unable to sign in right now. Please try again shortly.";
  }

  if (code === "GOOGLE_AUTH_FAILED") {
    return "Unable to sign in right now. Please try again shortly.";
  }

  if (code === "SMS_DISABLED") {
    return "Unable to send the verification code right now. Please try again shortly.";
  }

  if (code === "SMS_DELIVERY_FAILED") {
    return "Unable to send the verification code right now. Please try again shortly.";
  }

  if (code === "EMAIL_NOT_VERIFIED") {
    return "Please verify your email address before signing in.";
  }

  if (code === "PASSWORD_CHANGE_REQUIRED") {
    return "Your temporary password must be changed before you can continue.";
  }

  if (
    [
      "PLAN_UPGRADE_REQUIRED",
      "PLAN_LIMIT_REACHED",
      "USAGE_LIMIT_REACHED",
      "TRIAL_EXPIRED",
      "PLAN_EXPIRED",
      "PLAN_PAST_DUE",
      "PAYMENT_REQUIRED",
    ].includes(code)
  ) {
    return "This action is not available on your current plan.";
  }

  if (
    [
      "VALIDATION_ERROR",
      "BAD_REQUEST",
      "INVALID",
      "INVALID_TOKEN",
      "LIMIT",
      "INVITE_EXPIRED",
      "INVALID_STATE",
      "CONFLICT",
    ].includes(code)
  ) {
    return "Your request could not be completed. Please check your input and try again.";
  }

  if (code === "NOT_FOUND" || status === 404) {
    return "The requested record could not be found.";
  }

  if (code === "UNAUTHORIZED" || code === "FORBIDDEN" || status === 401) {
    return "You are not authorized to perform this action.";
  }

  if (status === 403) {
    return "This action could not be completed.";
  }

  if (
    [
      "NOT_READY",
      "INTERNAL_ERROR",
      "CONFIG_ERROR",
      "BAD_RESPONSE_FORMAT",
      "FETCH_FAILED",
      "UPLOAD_FAILED",
    ].includes(code) ||
    status >= 500
  ) {
    return "Something went wrong. Please try again shortly.";
  }

  return "Something went wrong. Please try again.";
}

function normalizeApiBaseUrl(input?: string) {
  const fallback = "http://localhost:8080";
  const raw = (input ?? "").trim();
  if (!raw) return fallback;

  let candidate = raw;

  // Common local misconfiguration: NEXT_PUBLIC_API_BASE_URL=:8080
  if (candidate.startsWith(":")) {
    candidate = `http://localhost${candidate}`;
  } else if (candidate.startsWith("//")) {
    candidate = `http:${candidate}`;
  } else if (!/^https?:\/\//i.test(candidate)) {
    candidate = `http://${candidate}`;
  }

  try {
    const url = new URL(candidate);
    return url.origin;
  } catch {
    return fallback;
  }
}

export const baseUrl = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL,
);

const LEGACY_TOKEN_KEY = "tl_access_token";
const ACTIVE_ORG_STORAGE_KEY = "tl_active_org_id";
const ACTIVE_ORG_EVENT = "tl-active-org-changed";
let accessToken: string | null = null;
let refreshInFlight: Promise<{ token: string | null; status: number }> | null =
  null;

if (typeof window !== "undefined") {
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function getActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
}

export function setActiveOrgId(orgId: string | null) {
  if (typeof window === "undefined") return;

  if (orgId) {
    window.localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId);
  } else {
    window.localStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
  }

  window.dispatchEvent(
    new CustomEvent(ACTIVE_ORG_EVENT, {
      detail: { orgId },
    }),
  );
}

export function subscribeToActiveOrgId(
  callback: (orgId: string | null) => void,
) {
  if (typeof window === "undefined") return () => {};

  const handleActiveOrgChange = (event: Event) => {
    const customEvent = event as CustomEvent<{ orgId?: string | null }>;
    callback(customEvent.detail?.orgId ?? getActiveOrgId());
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== ACTIVE_ORG_STORAGE_KEY) return;
    callback(event.newValue);
  };

  window.addEventListener(ACTIVE_ORG_EVENT, handleActiveOrgChange as EventListener);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(
      ACTIVE_ORG_EVENT,
      handleActiveOrgChange as EventListener,
    );
    window.removeEventListener("storage", handleStorage);
  };
}

function isAuthPath(path: string) {
  return path.startsWith("/api/v1/auth/");
}

function normalizeHostFromPublicUrl(value: string | undefined, fallback: string) {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;

  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "")
      .toLowerCase();
  }
}

function isPublicMarketingPath(pathname: string) {
  return pathname === "/" || pathname === "/blog" || pathname.startsWith("/blog/");
}

function shouldRedirectToLogin() {
  if (typeof window === "undefined") return false;
  const currentPath = window.location.pathname || "";
  const currentHost = window.location.hostname.toLowerCase();
  const appHost = normalizeHostFromPublicUrl(
    process.env.NEXT_PUBLIC_APP_URL,
    currentHost,
  );

  if (isPublicMarketingPath(currentPath)) return false;
  if (currentHost !== appHost) return false;
  return !currentPath.startsWith("/auth/");
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (!shouldRedirectToLogin()) return;
  window.location.replace("/auth/login");
}

function getRequestIdFromDetails(details: unknown) {
  if (
    details &&
    typeof details === "object" &&
    "requestId" in details &&
    typeof details.requestId === "string"
  ) {
    return details.requestId;
  }

  return null;
}

async function parseApiResponse<T>(
  res: Response,
  meta: { path: string; method?: string },
): Promise<ApiResponse<T>> {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    const parsed = (await res.json()) as ApiResponse<T>;
    if (parsed.ok) return parsed;

    captureFrontendApiError({
      path: meta.path,
      method: meta.method,
      status: res.status,
      code: parsed.error.code,
      requestId: getRequestIdFromDetails(parsed.error.details),
      message: parsed.error.message,
    });

    return {
      ok: false,
      error: {
        ...parsed.error,
        message: getUserSafeErrorMessage({
          code: parsed.error.code,
          status: res.status,
        }),
      },
    };
  }

  await res.text();
  return {
    ok: false,
    error: {
      code: "BAD_RESPONSE_FORMAT",
      message: getUserSafeErrorMessage({
        code: "BAD_RESPONSE_FORMAT",
        status: res.status,
      }),
      details: undefined,
    },
  };
}

async function refreshAccessToken(): Promise<{
  token: string | null;
  status: number;
}> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    const json = await parseApiResponse<{ accessToken: string }>(res, {
      path: "/api/v1/auth/refresh",
      method: "POST",
    });
    if (!json.ok) return { token: null, status: res.status };
    return { token: json.data.accessToken, status: 200 };
  } catch {
    return { token: null, status: 0 };
  }
}

export async function ensureAccessToken(args?: { forceRefresh?: boolean }) {
  if (!args?.forceRefresh && accessToken) {
    return { token: accessToken, status: 200 };
  }

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshed = await refreshAccessToken();
    if (refreshed.token) {
      setAccessToken(refreshed.token);
    } else if (refreshed.status === 401 || refreshed.status === 403) {
      setAccessToken(null);
    }
    return refreshed;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { orgId?: string; skipAuthRefresh?: boolean },
): Promise<ApiResponse<T>> {
  const headers = new Headers(init?.headers || {});
  headers.set("Content-Type", "application/json");
  const skipAuthRefresh = Boolean(init?.skipAuthRefresh);

  const orgId = init?.orgId ?? getActiveOrgId();
  if (orgId) headers.set("x-org-id", orgId);

  const authPath = isAuthPath(path);
  let token = getAccessToken();

  if (!token && !authPath && !skipAuthRefresh) {
    const refreshed = await ensureAccessToken();
    if (refreshed.token) {
      token = refreshed.token;
    } else if (refreshed.status === 401 || refreshed.status === 403) {
      if (typeof window !== "undefined") {
        setAccessToken(null);
        redirectToLogin();
      }
    }
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Normalize path and baseUrl
  const cleanPath = path.startsWith("http")
    ? new URL(path).pathname + new URL(path).search
    : path.startsWith("/")
      ? path
      : `/${path}`;

  const fullUrl = `${baseUrl}${cleanPath}`;

  try {
    const res = await fetch(fullUrl, {
      ...init,
      headers,
      credentials: "include",
    });

    if (res.status === 401 && !authPath && !skipAuthRefresh) {
      const { token: newToken, status: refreshStatus } =
        await ensureAccessToken({ forceRefresh: true });
      if (!newToken) {
        if (
          (refreshStatus === 401 || refreshStatus === 403) &&
          typeof window !== "undefined"
        ) {
          setAccessToken(null);
          setActiveOrgId(null);
          window.localStorage.removeItem("tl_user_profile");
          redirectToLogin();
        }
        return parseApiResponse<T>(res, {
          path: cleanPath,
          method: init?.method,
        });
      }

      setAccessToken(newToken);
      headers.set("Authorization", `Bearer ${newToken}`);

      const retryRes = await fetch(fullUrl, {
        ...init,
        headers,
        credentials: "include",
      });
      return parseApiResponse<T>(retryRes, {
        path: cleanPath,
        method: init?.method,
      });
    }

    return parseApiResponse<T>(res, {
      path: cleanPath,
      method: init?.method,
    });
  } catch {
    captureFrontendApiError({
      path: cleanPath,
      method: init?.method,
      code: "FETCH_FAILED",
      message: `Network request failed for ${cleanPath}`,
    });

    return {
      ok: false,
      error: {
        code: "FETCH_FAILED",
        message: getUserSafeErrorMessage({ code: "FETCH_FAILED" }),
        details: undefined,
      },
    };
  }
}

export async function apiUploadFile<T>(
  path: string,
  file: File,
  init?: { orgId?: string },
): Promise<ApiResponse<T>> {
  const formData = new FormData();
  formData.append("file", file);

  const headers = new Headers();
  const orgId = init?.orgId ?? getActiveOrgId();
  if (orgId) headers.set("x-org-id", orgId);

  const authPath = isAuthPath(path);
  let token = getAccessToken();

  if (!token && !authPath) {
    const refreshed = await ensureAccessToken();
    if (refreshed.token) {
      token = refreshed.token;
    } else if (refreshed.status === 401 || refreshed.status === 403) {
      if (typeof window !== "undefined") {
        setAccessToken(null);
        redirectToLogin();
      }
    }
  }

  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Normalize path and baseUrl
  const cleanPath = path.startsWith("http")
    ? new URL(path).pathname + new URL(path).search
    : path.startsWith("/")
      ? path
      : `/${path}`;

  const fullUrl = `${baseUrl}${cleanPath}`;

  try {
    const res = await fetch(fullUrl, {
      method: "POST",
      body: formData,
      headers,
      credentials: "include",
    });

    if (res.status === 401 && !authPath) {
      const { token: newToken, status: refreshStatus } =
        await ensureAccessToken({ forceRefresh: true });
      if (!newToken) {
        if (
          (refreshStatus === 401 || refreshStatus === 403) &&
          typeof window !== "undefined"
        ) {
          setAccessToken(null);
          setActiveOrgId(null);
          window.localStorage.removeItem("tl_user_profile");
          redirectToLogin();
        }
        return parseApiResponse<T>(res, {
          path: cleanPath,
          method: "POST",
        });
      }

      setAccessToken(newToken);
      headers.set("Authorization", `Bearer ${newToken}`);

      const retryRes = await fetch(fullUrl, {
        method: "POST",
        body: formData,
        headers,
        credentials: "include",
      });
      return parseApiResponse<T>(retryRes, {
        path: cleanPath,
        method: "POST",
      });
    }

    return parseApiResponse<T>(res, {
      path: cleanPath,
      method: "POST",
    });
  } catch {
    captureFrontendApiError({
      path: cleanPath,
      method: "POST",
      code: "UPLOAD_FAILED",
      message: `File upload failed for ${cleanPath}`,
    });

    return {
      ok: false,
      error: {
        code: "UPLOAD_FAILED",
        message: getUserSafeErrorMessage({ code: "UPLOAD_FAILED" }),
        details: undefined,
      },
    };
  }
}
