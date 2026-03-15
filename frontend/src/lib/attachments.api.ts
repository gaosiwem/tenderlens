export async function uploadWorkspaceAttachment(
  workspaceId: string,
  file: File,
  taskId?: string,
) {
  const form = new FormData();
  form.append("file", file);
  if (taskId) form.append("taskId", taskId);

  const res = await fetch(`/api/v1/attachments/workspaces/${workspaceId}`, {
    method: "POST",
    body: form,
    credentials: "include",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok)
    return {
      ok: false as const,
      error: { message: json?.error?.message ?? "Upload failed" },
    };
  return { ok: true as const, data: json?.data ?? json };
}
