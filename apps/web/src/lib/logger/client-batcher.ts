/**
 * Client-side batcher that ships log entries to `/api/v1/client-logs` so
 * INFO/WARN/ERROR output ends up in Cloud Logging instead of the browser
 * console (keeping the console clean for end users in production).
 *
 * Behaviour:
 * - Entries accumulate in an in-memory queue.
 * - The queue flushes when either (a) `MAX_BATCH_SIZE` entries accumulate,
 *   or (b) `FLUSH_INTERVAL_MS` elapses since the first queued entry,
 *   whichever happens first.
 * - On `pagehide` / `beforeunload`, a final flush is attempted via
 *   `navigator.sendBeacon` so in-flight entries are not lost when the
 *   tab closes.
 *
 * The batcher is isolated from the logger module so it can be unit-tested
 * without a DOM and without touching the global `window`.
 */

export interface ClientLogEntry {
  level: "debug" | "info" | "warn" | "error";
  context: string;
  message: string;
  data?: Record<string, unknown>;
  correlationId?: string;
  timestamp: string;
}

/** Flush after this many entries are queued. */
export const MAX_BATCH_SIZE = 50;

/** Flush at most this often (ms) when entries are present. */
export const FLUSH_INTERVAL_MS = 1000;

/** Endpoint that accepts a JSON array of {@link ClientLogEntry}. */
export const CLIENT_LOG_ENDPOINT = "/api/v1/client-logs";

export interface BatcherDeps {
  /** Override for tests; defaults to global `fetch`. */
  fetch?: typeof fetch;
  /** Override for tests; defaults to `navigator.sendBeacon` when available. */
  sendBeacon?: (url: string, data: string) => boolean;
  /** Override for tests; defaults to `setTimeout`. */
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  /** Override for tests; defaults to `clearTimeout`. */
  clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void;
  /** Endpoint override (defaults to {@link CLIENT_LOG_ENDPOINT}). */
  endpoint?: string;
  /** Maximum entries per batch (defaults to {@link MAX_BATCH_SIZE}). */
  maxBatchSize?: number;
  /** Flush interval in ms (defaults to {@link FLUSH_INTERVAL_MS}). */
  flushIntervalMs?: number;
}

export interface ClientLogBatcher {
  enqueue(entry: ClientLogEntry): void;
  /** Flush queued entries asynchronously via `fetch`. Returns the request promise (or null when empty). */
  flush(): Promise<void> | null;
  /** Synchronously flush via `sendBeacon` (page unload path). */
  flushBeacon(): boolean;
  /** Current queue length (testing). */
  size(): number;
}

export function createClientLogBatcher(deps: BatcherDeps = {}): ClientLogBatcher {
  const endpoint = deps.endpoint ?? CLIENT_LOG_ENDPOINT;
  const maxBatchSize = deps.maxBatchSize ?? MAX_BATCH_SIZE;
  const flushIntervalMs = deps.flushIntervalMs ?? FLUSH_INTERVAL_MS;
  const fetchFn = deps.fetch ?? (globalThis.fetch?.bind(globalThis) as typeof fetch | undefined);
  const sendBeaconFn =
    deps.sendBeacon ??
    (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
      ? navigator.sendBeacon.bind(navigator)
      : undefined);
  const setTimeoutFn = deps.setTimeout ?? setTimeout;
  const clearTimeoutFn = deps.clearTimeout ?? clearTimeout;

  let queue: ClientLogEntry[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function armTimer(): void {
    if (timer !== null) return;
    timer = setTimeoutFn(() => {
      timer = null;
      void flush();
    }, flushIntervalMs);
  }

  function drainQueue(): ClientLogEntry[] {
    if (timer !== null) {
      clearTimeoutFn(timer);
      timer = null;
    }
    const drained = queue;
    queue = [];
    return drained;
  }

  function enqueue(entry: ClientLogEntry): void {
    queue.push(entry);
    if (queue.length >= maxBatchSize) {
      void flush();
    } else {
      armTimer();
    }
  }

  async function flush(): Promise<void> {
    const batch = drainQueue();
    if (batch.length === 0) return;
    if (!fetchFn) return;
    try {
      await fetchFn(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: batch }),
        keepalive: true,
      });
    } catch {
      // Swallow — never surface logger transport failures to the app.
      // (Re-queueing on failure could amplify outages; drop instead.)
    }
  }

  function flushBeacon(): boolean {
    const batch = drainQueue();
    if (batch.length === 0) return true;
    if (!sendBeaconFn) return false;
    const blob = JSON.stringify({ entries: batch });
    try {
      return sendBeaconFn(endpoint, blob);
    } catch {
      return false;
    }
  }

  return {
    enqueue,
    flush: () => (queue.length === 0 && timer === null ? null : flush()),
    flushBeacon,
    size: () => queue.length,
  };
}
