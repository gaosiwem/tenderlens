import { apiFetch, baseUrl, ensureAccessToken, getActiveOrgId } from "./api";

export async function triggerETendersScrape(params: {
  limit: number;
  start: number;
  status: number;
  stopOnExisting: boolean;
}) {
  const query = new URLSearchParams({
    limit: String(params.limit),
    start: String(params.start),
    status: String(params.status),
    stopOnExisting: String(params.stopOnExisting),
  });
  return apiFetch<any>(`/api/v1/tenders/import-etenders?${query}`, {
    method: "POST",
  });
}

export type ScrapeProgressEvent = {
  source: string;
  requested: number;
  status: number;
  processed: number;
  imported: number;
  skipped: number;
  currentStart: number;
  batchSize: number;
  stopTriggered: boolean;
  elapsedMs: number;
};

export function triggerETendersScrapeStream(args: {
  limit: number;
  start: number;
  status: number;
  stopOnExisting: boolean;
  onStarted?: (event: ScrapeProgressEvent) => void;
  onProgress?: (event: ScrapeProgressEvent) => void;
  onDone?: (result: any) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}) {
  const controller = new AbortController();
  const merged = args.signal
    ? new AbortSignalAny([args.signal, controller.signal])
    : controller.signal;

  const run = async () => {
    const query = new URLSearchParams({
      limit: String(args.limit),
      start: String(args.start),
      status: String(args.status),
      stopOnExisting: String(args.stopOnExisting),
      stream: "true",
    });

    const { token } = await ensureAccessToken();
    const orgId = getActiveOrgId();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (orgId) headers["x-org-id"] = orgId;

    const res = await fetch(`${baseUrl}/api/v1/tenders/import-etenders?${query}`, {
      method: "POST",
      headers,
      credentials: "include",
      signal: merged as any,
    });

    if (!res.ok || !res.body) {
      let msg = `Scrape failed (${res.status})`;
      try {
        const j = await res.json();
        msg = j?.error?.message ?? msg;
      } catch {}
      args.onError?.(msg);
      return { ok: false as const, error: { message: msg } };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";
    let donePayload: any = null;

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
        } catch {
          continue;
        }

        if (event === "started") args.onStarted?.(data as ScrapeProgressEvent);
        if (event === "progress") args.onProgress?.(data as ScrapeProgressEvent);
        if (event === "done") {
          donePayload = data;
          args.onDone?.(data);
        }
        if (event === "error") {
          const msg = String(data?.message ?? "Scrape stream error");
          args.onError?.(msg);
          return { ok: false as const, error: { message: msg } };
        }
      }
    }

    if (!donePayload) {
      const msg = "Scrape stream ended unexpectedly";
      args.onError?.(msg);
      return { ok: false as const, error: { message: msg } };
    }

    return { ok: true as const, data: donePayload };
  };

  return {
    cancel: () => controller.abort(),
    run,
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
