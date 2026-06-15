/**
 * Minimal Tabstack Research client.
 *
 * Calls `POST https://api.tabstack.ai/v1/research` and aggregates the SSE stream
 * until the `complete` event arrives, returning the synthesized answer plus
 * source URLs. Used by the TLDR/FAQ migration to inject fresh factual context
 * into the generation prompt. Intentionally minimal — no retries, no streaming
 * API surface, just one call = one answer.
 *
 * Costs 500 credits/action in `fast` mode. Upstream docs:
 *   https://docs.tabstack.ai/api/resources/agent/methods/research/
 */
export interface ResearchResult {
  answer: string;
  sources: string[];
}

export interface ResearchOptions {
  apiKey: string;
  mode?: "fast" | "balanced";
  /** Passed to Tabstack as `fetch_timeout` (seconds). */
  fetchTimeoutSec?: number;
  /** Abort the whole client if the stream stalls this long (ms). */
  timeoutMs?: number;
}

export async function tabstackResearch(
  query: string,
  opts: ResearchOptions,
): Promise<ResearchResult> {
  const { apiKey, mode = "fast", fetchTimeoutSec = 30, timeoutMs = 60_000 } =
    opts;
  if (!apiKey) throw new Error("tabstackResearch: apiKey is required");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.tabstack.ai/v1/research", {
      method: "Article",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        query,
        mode,
        fetch_timeout: fetchTimeoutSec,
      }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "<no body>");
      throw new Error(`tabstack ${res.status}: ${text.slice(0, 500)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    const sources: string[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      // Normalize line endings once so the frame-boundary scan has a single
      // separator to look for. Some SSE servers emit \r\n\r\n between frames.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let sepIdx = buffer.indexOf("\n\n");
      while (sepIdx !== -1) {
        const frame = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        const parsed = parseFrame(frame);
        if (!parsed) {
          sepIdx = buffer.indexOf("\n\n");
          continue;
        }
        if (parsed.event === "complete") {
          const payload = parsed.data as {
            report?: string;
            metadata?: { citedPages?: Array<{ url?: string }> };
          } | null;
          if (payload && typeof payload === "object") {
            if (typeof payload.report === "string") answer = payload.report;
            for (const p of payload.metadata?.citedPages ?? []) {
              if (p && typeof p.url === "string") sources.push(p.url);
            }
          }
        } else if (parsed.event === "error") {
          throw new Error(
            `tabstack stream error: ${JSON.stringify(parsed.data).slice(0, 500)}`,
          );
        }
        sepIdx = buffer.indexOf("\n\n");
      }
    }
    return { answer, sources };
  } finally {
    clearTimeout(timer);
  }
}

function parseFrame(frame: string): { event: string; data: unknown } | null {
  const lines = frame.split(/\r?\n/);
  let eventName = "message";
  const dataParts: string[] = [];
  for (const line of lines) {
    if (line.startsWith(":")) continue; // comment line
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataParts.push(line.slice(5).trim());
  }
  if (!dataParts.length) return null;
  const raw = dataParts.join("\n");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  return { event: eventName, data };
}
