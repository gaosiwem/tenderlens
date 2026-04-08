import {
  baseUrl,
  ensureAccessToken,
  getActiveOrgId,
  getUserSafeErrorMessage,
} from "./api";

export async function downloadBlob(url: string, filename: string) {
  const isApiUrl = url.startsWith("/") || url.startsWith(`${baseUrl}/`);

  if (!isApiUrl) {
    const direct = await fetch(url);
    if (!direct.ok) {
      throw new Error("Download failed");
    }

    const blob = await direct.blob();
    const a = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
    return;
  }

  const fullUrl = url.startsWith("/") ? `${baseUrl}${url}` : url;
  const headers = new Headers();

  const orgId = getActiveOrgId();
  if (orgId) headers.set("x-org-id", orgId);

  let token = (await ensureAccessToken()).token;

  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(fullUrl, {
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    const newToken = (await ensureAccessToken({ forceRefresh: true })).token;
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      res = await fetch(fullUrl, {
        headers,
        credentials: "include",
      });
    }
  }

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    const err = new Error(json?.error?.message ?? "Download failed") as Error & {
      code?: string;
      upgrade?: unknown;
    };
    err.code = json?.error?.code;
    err.upgrade = json?.error?.upgrade;
    err.message = getUserSafeErrorMessage({
      code: json?.error?.code,
      status: res.status,
    });
    throw err;
  }

  const blob = await res.blob();
  const a = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);

  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}
