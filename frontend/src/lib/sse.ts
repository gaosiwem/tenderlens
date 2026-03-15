import type {
  StreamMetaEvent,
  StreamTokenEvent,
  StreamDoneEvent,
} from "./stream.types";
import { baseUrl, getAccessToken, getActiveOrgId } from "./api";

export type StreamHandlers = {
  onMeta?: (m: StreamMetaEvent) => void;
  onToken?: (t: StreamTokenEvent) => void;
  onDone?: (d: StreamDoneEvent) => void;
  onError?: (message: string) => void;
};

export function streamChatMessage(args: {
  conversationId: string;
  question: string;
  handlers: StreamHandlers;
  signal?: AbortSignal;
}) {
  const { conversationId, question, handlers, signal } = args;

  const controller = new AbortController();
  const merged = signal
    ? new AbortSignalAny([signal, controller.signal])
    : controller.signal;

  async function start() {
    const token = getAccessToken();
    const orgId = getActiveOrgId();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (orgId) headers["x-org-id"] = orgId;

    const res = await fetch(
      `${baseUrl}/api/v1/chat/conversations/${conversationId}/stream`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ question }),
        signal: merged as any,
      },
    );

    if (!res.ok || !res.body) {
      let msg = `Stream failed (${res.status})`;
      try {
        const j = await res.json();
        msg = j?.error?.message ?? msg;
      } catch {}
      handlers.onError?.(msg);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      while (true) {
        const idx = buf.indexOf("\n\n");
        if (idx === -1) break;
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);

        const lines = chunk.split("\n");
        let event = "message";
        let dataLine = "";
        for (const ln of lines) {
          if (ln.startsWith("event:")) event = ln.replace("event:", "").trim();
          if (ln.startsWith("data:"))
            dataLine += ln.replace("data:", "").trim();
        }

        if (!dataLine) continue;
        let data: any = null;
        try {
          data = JSON.parse(dataLine);
        } catch {}

        if (event === "meta") handlers.onMeta?.(data);
        if (event === "token") handlers.onToken?.(data);
        if (event === "done") handlers.onDone?.(data);
        if (event === "error")
          handlers.onError?.(String(data?.message ?? "Stream error"));
      }
    }
  }

  start().catch((e) => {
    if (e.name === "AbortError") return;
    handlers.onError?.(e?.message ?? "Stream error");
  });

  return {
    cancel: () => controller.abort(),
  };
}

class AbortSignalAny {
  private ctrl = new AbortController();
  signal: AbortSignal;

  constructor(signals: AbortSignal[]) {
    this.signal = this.ctrl.signal;
    for (const s of signals) {
      if (s.aborted) this.ctrl.abort();
      else s.addEventListener("abort", () => this.ctrl.abort(), { once: true });
    }
  }
}
