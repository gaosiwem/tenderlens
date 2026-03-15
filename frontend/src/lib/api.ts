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

  if (code === "EMAIL_NOT_VERIFIED") {
    return "Please verify your email address before signing in.";
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

const TOKEN_KEY = "tl_access_token";

let accessToken: string | null =
  typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  }
}

export function getAccessToken() {
  return accessToken;
}

export function getActiveOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("tl_active_org_id");
}

function isAuthPath(path: string) {
  return path.startsWith("/api/v1/auth/");
}

function shouldRedirectToLogin() {
  if (typeof window === "undefined") return false;
  const currentPath = window.location.pathname || "";
  return !currentPath.startsWith("/auth/");
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  if (!shouldRedirectToLogin()) return;
  window.location.replace("/auth/login");
}

async function parseApiResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    const parsed = (await res.json()) as ApiResponse<T>;
    if (parsed.ok) return parsed;
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

async function refreshAccessToken(): Promise<{ token: string | null; status: number }> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    const json = await parseApiResponse<{ accessToken: string }>(res);
    if (!json.ok) return { token: null, status: res.status };
    return { token: json.data.accessToken, status: 200 };
  } catch {
    return { token: null, status: 0 };
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { orgId?: string },
): Promise<ApiResponse<T>> {
  const headers = new Headers(init?.headers || {});
  headers.set("Content-Type", "application/json");

  const orgId = init?.orgId ?? getActiveOrgId();
  if (orgId) headers.set("x-org-id", orgId);

  const authPath = isAuthPath(path);
  let token = getAccessToken();

  if (!token && !authPath) {
    const { token: refreshed, status } = await refreshAccessToken();
    if (refreshed) {
      setAccessToken(refreshed);
      token = refreshed;
    } else if (status === 401 || status === 403) {
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

    if (res.status === 401 && !authPath) {
      const { token: newToken, status: refreshStatus } =
        await refreshAccessToken();
      if (!newToken) {
        if (
          (refreshStatus === 401 || refreshStatus === 403) &&
          typeof window !== "undefined"
        ) {
          setAccessToken(null);
          window.localStorage.removeItem("tl_active_org_id");
          window.localStorage.removeItem("tl_user_profile");
          redirectToLogin();
        }
        return parseApiResponse<T>(res);
      }

      setAccessToken(newToken);
      headers.set("Authorization", `Bearer ${newToken}`);

      const retryRes = await fetch(fullUrl, {
        ...init,
        headers,
        credentials: "include",
      });
      return parseApiResponse<T>(retryRes);
    }

    return parseApiResponse<T>(res);
  } catch {
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
    const { token: refreshed, status } = await refreshAccessToken();
    if (refreshed) {
      setAccessToken(refreshed);
      token = refreshed;
    } else if (status === 401 || status === 403) {
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
        await refreshAccessToken();
      if (!newToken) {
        if (
          (refreshStatus === 401 || refreshStatus === 403) &&
          typeof window !== "undefined"
        ) {
          setAccessToken(null);
          window.localStorage.removeItem("tl_active_org_id");
          window.localStorage.removeItem("tl_user_profile");
          redirectToLogin();
        }
        return parseApiResponse<T>(res);
      }

      setAccessToken(newToken);
      headers.set("Authorization", `Bearer ${newToken}`);

      const retryRes = await fetch(fullUrl, {
        method: "POST",
        body: formData,
        headers,
        credentials: "include",
      });
      return parseApiResponse<T>(retryRes);
    }

    return parseApiResponse<T>(res);
  } catch {
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
