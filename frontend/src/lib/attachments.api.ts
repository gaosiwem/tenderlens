import { apiUploadFile, baseUrl, ensureAccessToken } from "@/lib/api";

export async function uploadWorkspaceAttachment(
  workspaceId: string,
  file: File,
  taskId?: string,
) {
  return apiUploadFile<{ attachment: unknown }>(
    `/api/v1/attachments/workspaces/${workspaceId}${taskId ? `?taskId=${encodeURIComponent(taskId)}` : ""}`,
    file,
  );
}

function filenameFromDisposition(
  contentDisposition: string | null,
  fallbackName: string,
) {
  if (!contentDisposition) return fallbackName;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return fallbackName;
    }
  }

  const asciiMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  return asciiMatch?.[1] ?? fallbackName;
}

export async function downloadWorkspaceAttachment(
  attachmentId: string,
  fallbackName: string,
) {
  const { token } = await ensureAccessToken();
  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(
    `${baseUrl}/api/v1/attachments/${attachmentId}/download`,
    {
      method: "GET",
      headers,
      credentials: "include",
    },
  );

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    return {
      ok: false as const,
      error: { message: json?.error?.message ?? "Download failed" },
    };
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filenameFromDisposition(
    res.headers.get("content-disposition"),
    fallbackName,
  );
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);

  return { ok: true as const };
}
