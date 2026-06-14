/**
 * GCP Cloud Logging transport for the structured logger.
 *
 * Activation: only when env `LOG_TRANSPORT=gcp` is set. Default logger
 * behavior (console output via Netlify's stream) is unchanged.
 *
 * Credentials (resolved in this order):
 *   1. Explicit `credentials` option passed to `createGcpCloudLoggingTransport`.
 *   2. `GOOGLE_APPLICATION_CREDENTIALS_JSON` env var (JSON-encoded service
 *      account key).
 *   3. `FIREBASE_ADMIN_CLIENT_EMAIL` + `FIREBASE_ADMIN_PRIVATE_KEY` env vars
 *      (same service account already used by `firebase-admin`). This is the
 *      production path on Netlify, where ADC is not available.
 *   4. Application Default Credentials (workload identity, well-known file).
 *
 * The principal must have `roles/logging.logWriter` on the target project
 * (`pooriaarab-blogbat`).
 *
 * Cold-start cost: `@google-cloud/logging` is lazy-imported only when the
 * transport is constructed (i.e. only when LOG_TRANSPORT=gcp). Default
 * cold starts pay no extra cost.
 */
export type LogSeverity =
  | "DEBUG"
  | "INFO"
  | "NOTICE"
  | "WARNING"
  | "ERROR"
  | "CRITICAL"
  | "ALERT"
  | "EMERGENCY"
  | "DEFAULT";

export type LoggerLevel = "debug" | "info" | "warn" | "error" | "fatal";

/** Map logger levels to Cloud Logging severity strings. */
export function levelToSeverity(level: LoggerLevel): LogSeverity {
  switch (level) {
    case "debug":
      return "DEBUG";
    case "info":
      return "INFO";
    case "warn":
      return "WARNING";
    case "error":
      return "ERROR";
    case "fatal":
      return "CRITICAL";
    default:
      return "DEFAULT";
  }
}

export interface GcpTransportRecord {
  level: LoggerLevel;
  context: string;
  message: string;
  data?: Record<string, unknown>;
  correlationId?: string;
  timestamp?: string;
}

export interface GcpTransport {
  write(record: GcpTransportRecord): void;
}

export interface GcpLogHandle {
  entry: (
    meta: Record<string, unknown>,
    data: Record<string, unknown>,
  ) => unknown;
  write: (entry: unknown) => Promise<unknown>;
}

export interface GcpLoggingClient {
  log: (name: string) => GcpLogHandle;
}

export interface GcpServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

export interface GcpLoggingClientConfig {
  projectId: string;
  credentials?: GcpServiceAccountCredentials;
}

export interface GcpLoggingModule {
  Logging: new (cfg: GcpLoggingClientConfig) => GcpLoggingClient;
}

export interface CreateGcpTransportOptions {
  /** GCP project ID. Defaults to `pooriaarab-blogbat`. */
  projectId?: string;
  /** Cloud Logging log name. Defaults to `blogbat`. */
  logName?: string;
  /** Resource type label. Defaults to `global`. */
  resourceType?: string;
  /** Optional onError callback invoked when a write fails. */
  onError?: (err: unknown) => void;
  /**
   * Optional module loader (for testability). Defaults to lazy-requiring
   * `@google-cloud/logging` — keeps cold starts cheap because the dep is
   * only loaded when the transport is actually constructed.
   */
  loadModule?: () => GcpLoggingModule;
  /**
   * Optional explicit service account credentials. When omitted the transport
   * reads `GOOGLE_APPLICATION_CREDENTIALS_JSON` or the Firebase admin env
   * pair, then falls back to Application Default Credentials.
   *
   * On Netlify, ADC is not configured, so we read from the
   * `FIREBASE_ADMIN_CLIENT_EMAIL` / `FIREBASE_ADMIN_PRIVATE_KEY` env vars by
   * default (same service account already used by firebase-admin). The
   * principal must have `roles/logging.logWriter` on `pooriaarab-blogbat`.
   */
  credentials?: GcpServiceAccountCredentials;
}

/**
 * Read service account credentials from env, preferring an explicit GCP
 * service account JSON (`GOOGLE_APPLICATION_CREDENTIALS_JSON`) and falling
 * back to the Firebase admin SDK env vars already present in production.
 * Returns `undefined` when neither pair is available, in which case the
 * `@google-cloud/logging` client falls back to ADC.
 */
function readCredentialsFromEnv(): GcpServiceAccountCredentials | undefined {
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json) as Partial<GcpServiceAccountCredentials>;
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch {
      // Fall through to firebase-admin env vars.
    }
  }
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (clientEmail && privateKey) {
    return {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n"),
    };
  }
  return undefined;
}

const DEFAULT_PROJECT_ID = "pooriaarab-blogbat";
const DEFAULT_LOG_NAME = "blogbat";
const DEFAULT_RESOURCE_TYPE = "global";

interface NodeModuleBuiltin {
  createRequire: (url: string) => NodeJS.Require;
}

function defaultLoadModule(): GcpLoggingModule {
  // Resolve `createRequire` via `process.getBuiltinModule("module")` (Node
  // 22.6+) so we can lazy-load `@google-cloud/logging` from inside Next 16's
  // Turbopack ESM server bundle without a static `import "node:module"` at
  // the top of this file — which would block client-bundle compilation
  // (Turbopack refuses node: built-ins for the client graph).
  //
  // The previous `(0, eval)("require")(...)` form threw
  // `ReferenceError: require is not defined` inside the ESM bundle because
  // `require` is not a global in ESM. That error was swallowed by the
  // construction-time try/catch (no-op transport on failure), so zero log
  // entries reached Cloud Logging in production.
  //
  // `@google-cloud/logging` is listed in `serverExternalPackages` in
  // `next.config.ts`, so Turbopack leaves it as a runtime resolution rather
  // than trying to bundle its Node-only transitive deps.
  //
  // Only invoked at runtime on the server when LOG_TRANSPORT=gcp, so this
  // path never runs in the browser.
  const proc = process as unknown as {
    getBuiltinModule?: (id: string) => NodeModuleBuiltin;
  };
  if (!proc.getBuiltinModule) {
    throw new Error(
      "process.getBuiltinModule is unavailable (requires Node 22.6+); " +
        "cannot lazy-load @google-cloud/logging from the ESM bundle.",
    );
  }
  const mod = proc.getBuiltinModule("module");
  const nodeRequire = mod.createRequire(import.meta.url);
  return nodeRequire("@google-cloud/logging") as GcpLoggingModule;
}

/**
 * Create a GCP Cloud Logging transport. The `@google-cloud/logging` package
 * is lazy-loaded inside this function so callers that never invoke it pay
 * no cold-start cost.
 *
 * Writes are fire-and-forget: failures are surfaced via the optional
 * `onError` callback so the logger never throws into the request hot path.
 */
export function createGcpCloudLoggingTransport(
  options: CreateGcpTransportOptions = {},
): GcpTransport {
  const projectId = options.projectId ?? DEFAULT_PROJECT_ID;
  const logName = options.logName ?? DEFAULT_LOG_NAME;
  const resourceType = options.resourceType ?? DEFAULT_RESOURCE_TYPE;
  const onError =
    options.onError ??
    ((err: unknown) => {
      // Last-resort: print to stderr so we still get a trail in Netlify.
      console.error("[gcp-cloud-logging] write failed", err);
    });
  const loadModule = options.loadModule ?? defaultLoadModule;

  // Lazy-init: load the client and bind the log handle on first construction.
  // Synchronous so write() can stay sync — matches the existing logger shape.
  let log: GcpLogHandle;
  try {
    const mod = loadModule();
    const credentials = options.credentials ?? readCredentialsFromEnv();
    const cfg: GcpLoggingClientConfig = credentials
      ? { projectId, credentials }
      : { projectId };
    const logging = new mod.Logging(cfg);
    log = logging.log(logName);
  } catch (err) {
    onError(err);
    // Return a no-op transport so callers never crash on construction.
    return { write: () => undefined };
  }

  return {
    write(record: GcpTransportRecord) {
      try {
        const severity = levelToSeverity(record.level);
        const meta = {
          severity,
          resource: { type: resourceType },
          labels: {
            context: record.context,
            ...(record.correlationId
              ? { correlation_id: record.correlationId }
              : {}),
          },
          ...(record.timestamp ? { timestamp: record.timestamp } : {}),
        };
        const payload: Record<string, unknown> = {
          ...(record.data ?? {}),
          message: record.message,
          context: record.context,
          ...(record.correlationId
            ? { correlationId: record.correlationId }
            : {}),
        };
        const entry = log.entry(meta, payload);
        // Fire and forget — never block the caller, never throw out.
        Promise.resolve(log.write(entry)).catch(onError);
      } catch (err) {
        onError(err);
      }
    },
  };
}
