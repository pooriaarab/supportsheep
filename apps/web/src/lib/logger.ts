/**
 * Structured logger for the application.
 * Replaces raw console.* calls with contextual, level-aware logging.
 *
 * On the client, INFO/WARN/ERROR entries are shipped to the
 * `/api/v1/client-logs` endpoint so they end up in Cloud Logging (via the
 * Netlify Function stream). In production, this replaces console output
 * entirely so end users see a clean console. In development, both happen
 * so the local devtools console keeps working alongside the tail file.
 */
import {
  createGcpCloudLoggingTransport,
  type GcpTransport,
  type LoggerLevel as TransportLevel,
} from "@/lib/logger/transports/gcp-cloud-logging";
import {
  createClientLogBatcher,
  type ClientLogBatcher,
  type ClientLogEntry,
} from "@/lib/logger/client-batcher";

// Registration hook for correlation ID — set by correlation.ts on import
// so the logger never imports async_hooks directly (safe for client bundles).
let correlationIdGetter: (() => string | undefined) | null = null;

export function registerCorrelationIdGetter(
  getter: () => string | undefined,
): void {
  correlationIdGetter = getter;
}

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Optional remote transport (currently: GCP Cloud Logging). Initialised lazily
// on first createLogger() call when env activation is detected. Default: null,
// so log output is unchanged from the Netlify-stream-only behavior.
let remoteTransport: GcpTransport | null | undefined;

function getRemoteTransport(): GcpTransport | null {
  if (remoteTransport !== undefined) return remoteTransport;
  if (process.env.LOG_TRANSPORT !== "gcp") {
    remoteTransport = null;
    return remoteTransport;
  }
  try {
    // The transport factory is statically imported above, but the underlying
    // `@google-cloud/logging` SDK is loaded via an indirect require inside
    // the factory — so neither cold starts nor client bundles pay for it
    // when LOG_TRANSPORT is unset.
    remoteTransport = createGcpCloudLoggingTransport();
  } catch (err) {
    // If transport construction fails (missing module, invalid creds, etc),
    // fall back to console-only logging — never break the request path.
    console.error("[logger] failed to initialise GCP transport", err);
    remoteTransport = null;
  }
  return remoteTransport;
}

/** Internal hook for tests to inspect transport selection. */
export function __getRemoteTransportForTests(): GcpTransport | null {
  return getRemoteTransport();
}

/** Internal hook for tests to reset cached transport between cases. */
export function __resetRemoteTransportForTests(): void {
  remoteTransport = undefined;
}

// Browser-side batcher (lazy). Always null on the server, where remote
// transport / console output is the source of truth.
let clientBatcher: ClientLogBatcher | null | undefined;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function getClientBatcher(): ClientLogBatcher | null {
  if (clientBatcher !== undefined) return clientBatcher;
  if (!isBrowser()) {
    clientBatcher = null;
    return clientBatcher;
  }
  const batcher = createClientLogBatcher();
  clientBatcher = batcher;
  // Best-effort final flush on page hide / unload via sendBeacon.
  const handler = () => {
    batcher.flushBeacon();
  };
  window.addEventListener("pagehide", handler);
  window.addEventListener("beforeunload", handler);
  return clientBatcher;
}

/** Internal hook for tests — reset the cached client batcher. */
export function __resetClientBatcherForTests(): void {
  clientBatcher = undefined;
}

/** Internal hook for tests — inject a stub batcher. */
export function __setClientBatcherForTests(b: ClientLogBatcher | null): void {
  clientBatcher = b;
}

function getMinLevel(): LogLevel {
  if (process.env.NODE_ENV === "production") return "info";
  return "debug";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getMinLevel()];
}

function formatMessage(
  level: LogLevel,
  context: string,
  message: string,
  data?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString();
  const cid = correlationIdGetter?.();
  const cidSuffix = cid ? ` [cid:${cid}]` : "";
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]${cidSuffix}`;
  if (data && Object.keys(data).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

function emit(
  level: LogLevel,
  context: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;
  const cid = correlationIdGetter?.();
  const timestamp = new Date().toISOString();

  // On the browser, route log entries through the batcher so they land in
  // Cloud Logging (via /api/v1/client-logs). In dev we keep the console
  // output too so devtools is still usable; in prod we suppress console
  // so users see a clean log surface.
  if (isBrowser()) {
    const batcher = getClientBatcher();
    if (batcher) {
      const entry: ClientLogEntry = {
        level,
        context,
        message,
        data,
        correlationId: cid,
        timestamp,
      };
      batcher.enqueue(entry);
    }
    if (process.env.NODE_ENV !== "production") {
      writeToConsole(level, formatMessage(level, context, message, data));
    }
    return;
  }

  // Server-side: existing behaviour (console + optional GCP transport).
  writeToConsole(level, formatMessage(level, context, message, data));
  const transport = getRemoteTransport();
  if (transport) {
    transport.write({
      level: level as TransportLevel,
      context,
      message,
      data,
      correlationId: cid,
      timestamp,
    });
  }
}

function writeToConsole(level: LogLevel, formatted: string): void {
  switch (level) {
    case "debug":
      console.debug(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "error":
      console.error(formatted);
      break;
  }
}

/** Create a logger with a given context name. */
export function createLogger(context: string): Logger {
  // Touch the transport accessor so it initialises (or stays null) at logger
  // construction time, not on the first log call inside a hot path.
  getRemoteTransport();
  return {
    debug(message: string, data?: Record<string, unknown>) {
      emit("debug", context, message, data);
    },
    info(message: string, data?: Record<string, unknown>) {
      emit("info", context, message, data);
    },
    warn(message: string, data?: Record<string, unknown>) {
      emit("warn", context, message, data);
    },
    error(message: string, data?: Record<string, unknown>) {
      emit("error", context, message, data);
    },
  };
}

/** Default app-wide logger. */
export const logger = createLogger("app");

/**
 * Wraps an async operation with structured start/end logs so a single
 * `gcloud logging read` query can find both sides of every external call
 * (e.g. Anthropic, OpenAI realtime mint, Tavus mint). On success the
 * completed log carries `status: "success"` and `durationMs`. On failure
 * the error is re-thrown after logging `status: "failed"`, `errorMessage`,
 * `errorKind`, `errorStack`, and `durationMs` — so callers keep their
 * existing try/catch behaviour without rewriting it.
 *
 * Standard field names match the project's logging convention:
 *   - `interviewId` (caller adds via `context`)
 *   - `durationMs`
 *   - `status` ("success" | "failed")
 *   - `errorMessage`
 *   - `errorKind`
 *   - `errorStack`
 */
export async function withStructuredLog<T>(
  log: Logger,
  operation: string,
  context: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  log.info(`${operation} started`, context);
  try {
    const result = await fn();
    log.info(`${operation} completed`, {
      ...context,
      durationMs: Date.now() - start,
      status: "success",
    });
    return result;
  } catch (err) {
    log.error(`${operation} failed`, {
      ...context,
      durationMs: Date.now() - start,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
      errorKind: err instanceof Error ? err.name : "unknown",
      errorStack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }
}
