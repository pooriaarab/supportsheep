import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createGcpCloudLoggingTransport,
  levelToSeverity,
  type GcpLoggingModule,
  type LoggerLevel,
  type LogSeverity,
} from "@/lib/logger/transports/gcp-cloud-logging";

describe("levelToSeverity", () => {
  const cases: Array<[LoggerLevel, LogSeverity]> = [
    ["debug", "DEBUG"],
    ["info", "INFO"],
    ["warn", "WARNING"],
    ["error", "ERROR"],
    ["fatal", "CRITICAL"],
  ];

  it.each(cases)("maps %s -> %s", (level, expected) => {
    expect(levelToSeverity(level)).toBe(expected);
  });
});

describe("createGcpCloudLoggingTransport", () => {
  it("writes a structured entry with mapped severity and labels", async () => {
    const entryMock = vi.fn(
      (meta: Record<string, unknown>, data: Record<string, unknown>) => ({
        meta,
        data,
      }),
    );
    const writeMock = vi.fn().mockResolvedValue(undefined);
    const logMock = vi.fn(() => ({ entry: entryMock, write: writeMock }));

    const fakeModule: GcpLoggingModule = {
      Logging: class {
        log = logMock;
      } as unknown as GcpLoggingModule["Logging"],
    };

    const transport = createGcpCloudLoggingTransport({
      projectId: "test-project",
      logName: "blogbat",
      resourceType: "global",
      loadModule: () => fakeModule,
    });

    transport.write({
      level: "error",
      context: "interview.end",
      message: "boom",
      data: { reqId: "abc" },
      correlationId: "cid-xyz",
      timestamp: "2026-05-21T00:00:00.000Z",
    });

    // Allow the fire-and-forget write microtask to flush.
    await Promise.resolve();

    expect(logMock).toHaveBeenCalledWith("blogbat");
    expect(entryMock).toHaveBeenCalledTimes(1);
    const [meta, payload] = entryMock.mock.calls[0] ?? [];
    expect(meta).toMatchObject({
      severity: "ERROR",
      resource: { type: "global" },
      labels: { context: "interview.end", correlation_id: "cid-xyz" },
      timestamp: "2026-05-21T00:00:00.000Z",
    });
    expect(payload).toMatchObject({
      message: "boom",
      context: "interview.end",
      correlationId: "cid-xyz",
      reqId: "abc",
    });
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it("omits correlation labels when no correlation id is present", () => {
    const entryMock = vi.fn(() => ({}));
    const writeMock = vi.fn().mockResolvedValue(undefined);
    const fakeModule: GcpLoggingModule = {
      Logging: class {
        log() {
          return { entry: entryMock, write: writeMock };
        }
      } as unknown as GcpLoggingModule["Logging"],
    };

    const transport = createGcpCloudLoggingTransport({
      loadModule: () => fakeModule,
    });

    transport.write({ level: "info", context: "x", message: "y" });

    const [meta, payload] = entryMock.mock.calls[0] ?? [];
    expect((meta as Record<string, unknown>).labels).toEqual({ context: "x" });
    expect((payload as Record<string, unknown>).correlationId).toBeUndefined();
  });

  it("does not throw and reports via onError when module loading fails", () => {
    const onError = vi.fn();
    const transport = createGcpCloudLoggingTransport({
      onError,
      loadModule: () => {
        throw new Error("module not found");
      },
    });

    expect(() =>
      transport.write({ level: "info", context: "x", message: "y" }),
    ).not.toThrow();
    expect(onError).toHaveBeenCalled();
  });

  it("default module loader (no stub) does not throw `ReferenceError: require is not defined`", () => {
    // Regression test for the Next 16 + Turbopack ESM bug: the previous
    // `(0, eval)("require")` form threw `ReferenceError: require is not
    // defined` inside the ESM server bundle because `require` is not a
    // global in ESM. `createRequire(import.meta.url)` works in both CJS
    // and ESM contexts.
    //
    // The transport may still surface a non-Reference auth error via
    // `onError` because no credentials may be configured in the test env —
    // that's expected; the failure mode this test guards against is
    // specifically the silent ReferenceError.
    const onError = vi.fn();
    expect(() => createGcpCloudLoggingTransport({ onError })).not.toThrow();
    for (const call of onError.mock.calls) {
      const err = call[0];
      expect(
        err instanceof ReferenceError &&
          /require is not defined/i.test(err.message),
      ).toBe(false);
    }
  });

  it("write path with a stubbed module does not produce a ReferenceError", async () => {
    // Even with a fully working loader, ensure the synchronous write path
    // and the fire-and-forget microtask never raise ReferenceError.
    const onError = vi.fn();
    const writeMock = vi.fn().mockResolvedValue(undefined);
    const entryMock = vi.fn(() => ({}));
    const fakeModule: GcpLoggingModule = {
      Logging: class {
        log() {
          return { entry: entryMock, write: writeMock };
        }
      } as unknown as GcpLoggingModule["Logging"],
    };
    const transport = createGcpCloudLoggingTransport({
      onError,
      loadModule: () => fakeModule,
    });
    expect(() =>
      transport.write({ level: "info", context: "ctx", message: "hi" }),
    ).not.toThrow();
    await Promise.resolve();
    for (const call of onError.mock.calls) {
      const err = call[0];
      expect(
        err instanceof ReferenceError &&
          /require is not defined/i.test(err.message),
      ).toBe(false);
    }
    expect(writeMock).toHaveBeenCalledTimes(1);
  });

  it("passes explicit credentials to the GCP Logging client", () => {
    const ctorSpy = vi.fn();
    const fakeModule: GcpLoggingModule = {
      Logging: class {
        constructor(cfg: { projectId: string; credentials?: unknown }) {
          ctorSpy(cfg);
        }
        log() {
          return { entry: () => ({}), write: () => Promise.resolve() };
        }
      } as unknown as GcpLoggingModule["Logging"],
    };
    createGcpCloudLoggingTransport({
      projectId: "pooriaarab-blogbat",
      loadModule: () => fakeModule,
      credentials: {
        client_email: "svc@example.iam.gserviceaccount.com",
        private_key:
          "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n",
      },
    });
    expect(ctorSpy).toHaveBeenCalledWith({
      projectId: "pooriaarab-blogbat",
      credentials: {
        client_email: "svc@example.iam.gserviceaccount.com",
        private_key:
          "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n",
      },
    });
  });

  it("falls back to FIREBASE_ADMIN_* env vars when no explicit credentials given", () => {
    const prev = {
      email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      key: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
      json: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    };
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL =
      "fb-admin@example.iam.gserviceaccount.com";
    process.env.FIREBASE_ADMIN_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nXYZ\\n-----END PRIVATE KEY-----\\n";
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    try {
      const ctorSpy = vi.fn();
      const fakeModule: GcpLoggingModule = {
        Logging: class {
          constructor(cfg: { projectId: string; credentials?: unknown }) {
            ctorSpy(cfg);
          }
          log() {
            return { entry: () => ({}), write: () => Promise.resolve() };
          }
        } as unknown as GcpLoggingModule["Logging"],
      };
      createGcpCloudLoggingTransport({ loadModule: () => fakeModule });
      expect(ctorSpy).toHaveBeenCalledWith({
        projectId: "pooriaarab-blogbat",
        credentials: {
          client_email: "fb-admin@example.iam.gserviceaccount.com",
          private_key:
            "-----BEGIN PRIVATE KEY-----\nXYZ\n-----END PRIVATE KEY-----\n",
        },
      });
    } finally {
      restoreEnv("FIREBASE_ADMIN_CLIENT_EMAIL", prev.email);
      restoreEnv("FIREBASE_ADMIN_PRIVATE_KEY", prev.key);
      restoreEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON", prev.json);
    }
  });

  it("prefers GOOGLE_APPLICATION_CREDENTIALS_JSON over FIREBASE_ADMIN_* env vars", () => {
    const prev = {
      email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      key: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
      json: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    };
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "fb@example.iam";
    process.env.FIREBASE_ADMIN_PRIVATE_KEY = "fb-key";
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify({
      client_email: "gcp@example.iam",
      private_key: "gcp-key",
    });
    try {
      const ctorSpy = vi.fn();
      const fakeModule: GcpLoggingModule = {
        Logging: class {
          constructor(cfg: { projectId: string; credentials?: unknown }) {
            ctorSpy(cfg);
          }
          log() {
            return { entry: () => ({}), write: () => Promise.resolve() };
          }
        } as unknown as GcpLoggingModule["Logging"],
      };
      createGcpCloudLoggingTransport({ loadModule: () => fakeModule });
      expect(ctorSpy.mock.calls[0]?.[0]).toMatchObject({
        credentials: { client_email: "gcp@example.iam", private_key: "gcp-key" },
      });
    } finally {
      restoreEnv("FIREBASE_ADMIN_CLIENT_EMAIL", prev.email);
      restoreEnv("FIREBASE_ADMIN_PRIVATE_KEY", prev.key);
      restoreEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON", prev.json);
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("createLogger transport activation via env", () => {
  const originalEnv = process.env.LOG_TRANSPORT;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.LOG_TRANSPORT;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.LOG_TRANSPORT;
    } else {
      process.env.LOG_TRANSPORT = originalEnv;
    }
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("does NOT initialise the GCP transport when LOG_TRANSPORT is unset", async () => {
    const loggerMod = await import("@/lib/logger");
    loggerMod.__resetRemoteTransportForTests();
    const log = loggerMod.createLogger("test-ctx");
    log.info("hello", { foo: 1 });
    expect(loggerMod.__getRemoteTransportForTests()).toBeNull();
  });

  it("initialises and writes through the GCP transport when LOG_TRANSPORT=gcp", async () => {
    process.env.LOG_TRANSPORT = "gcp";

    const writeMock = vi.fn();
    vi.doMock("@/lib/logger/transports/gcp-cloud-logging", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/logger/transports/gcp-cloud-logging")
      >("@/lib/logger/transports/gcp-cloud-logging");
      return {
        ...actual,
        createGcpCloudLoggingTransport: () => ({ write: writeMock }),
      };
    });

    const loggerMod = await import("@/lib/logger");
    loggerMod.__resetRemoteTransportForTests();
    const log = loggerMod.createLogger("test-ctx");

    log.warn("uh oh", { code: 42 });

    expect(writeMock).toHaveBeenCalledTimes(1);
    const record = writeMock.mock.calls[0]?.[0];
    expect(record).toMatchObject({
      level: "warn",
      context: "test-ctx",
      message: "uh oh",
      data: { code: 42 },
    });
    expect(typeof record.timestamp).toBe("string");
  });

  it("createLogger returns a logger with the standard 4-method API", async () => {
    const loggerMod = await import("@/lib/logger");
    loggerMod.__resetRemoteTransportForTests();
    const log = loggerMod.createLogger("api");
    expect(typeof log.debug).toBe("function");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
  });
});
