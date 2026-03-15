export async function exportAnswerPdf(messageId: string) {
  const res = await fetch("/api/v1/export/chat/" + messageId, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  // Note: The spec suggested /api/v1/export/answer-pdf with POST and {messageId}
  // but my backend implementation used GET /api/v1/export/chat/:messageId.
  // I will stick to my backend route for now but use the blob approach from spec.

  if (!res.ok) {
    let err: any = null;
    try {
      err = await res.json();
    } catch {}
    return {
      ok: false as const,
      error: err?.error?.message ?? "Export failed",
    };
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { ok: true as const, url };
}

export async function exportConversationPdf(conversationId: string) {
  const res = await fetch(
    "/api/v1/export/chat/conversation/" + conversationId,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!res.ok) {
    let err: any = null;
    try {
      err = await res.json();
    } catch {}
    return {
      ok: false as const,
      error: err?.error?.message ?? "Export failed",
    };
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  return { ok: true as const, url };
}
