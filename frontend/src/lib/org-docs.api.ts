import {
  apiFetch,
  apiUploadFile,
  baseUrl,
  ensureAccessToken,
  getActiveOrgId,
  getUserSafeErrorMessage,
} from "@/lib/api";
import type {
  OrgBusinessDocsResponse,
  OrgBusinessDocUploadResponse,
} from "./org-docs.types";

export async function listOrgBusinessDocs() {
  return apiFetch<OrgBusinessDocsResponse>("/api/v1/org-docs/files", {
    method: "GET",
  });
}

export async function uploadOrgBusinessDoc(file: File) {
  return apiUploadFile<OrgBusinessDocUploadResponse>("/api/v1/org-docs/files", file);
}

export async function deleteOrgBusinessDoc(fileId: string) {
  return apiFetch<{ id: string; deleted: boolean }>(`/api/v1/org-docs/files/${fileId}`, {
    method: "DELETE",
  });
}

export async function openOrgBusinessDoc(args: {
  fileId: string;
  filename: string;
  mimeType: string;
}) {
  const headers = new Headers();
  const orgId = getActiveOrgId();
  if (orgId) headers.set("x-org-id", orgId);

  let token = (await ensureAccessToken()).token;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res = await fetch(`${baseUrl}/api/v1/org-docs/files/${args.fileId}/content`, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    token = (await ensureAccessToken({ forceRefresh: true })).token;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      res = await fetch(`${baseUrl}/api/v1/org-docs/files/${args.fileId}/content`, {
        method: "GET",
        headers,
        credentials: "include",
      });
    }
  }

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(
      getUserSafeErrorMessage({
        code: json?.error?.code,
        status: res.status,
      }),
    );
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  if (args.mimeType === "application/pdf") {
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = args.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
