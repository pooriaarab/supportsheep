/**
 * Interview stream parity smoke test.
 *
 * Opens `/api/v1/interviews/<id>/stream` (Netlify) and
 * `/api/v1/interviews/<id>/stream-gcp` (Cloud Function) concurrently for
 * the same interview, captures events for N seconds, normalises them,
 * and diffs the sequences. Exits non-zero if the backends diverge.
 *
 * Designed for use before flipping `NEXT_PUBLIC_INTERVIEW_STREAM_PROVIDER`
 * from `netlify` to `gcp` in a given context. Also runnable from CI
 * against a deploy preview.
 *
 * Usage:
 *   DEV_LOGIN_SECRET=<secret> bun apps/web/scripts/stream-parity-smoke.ts \
 *     --base-url https://blogbat.com \
 *     --interview-id <id> \
 *     --duration 30
 *
 * Flags:
 *   --base-url <url>           Target host (required, no trailing slash)
 *   --interview-id <id>        Interview id to subscribe to (required)
 *   --duration <seconds>       Capture window in seconds (default: 30)
 *   --ignore-kinds <a,b,c>     CSV of event kinds to drop before diffing
 *                              (default: writer_diff — Netlify-only until
 *                              PR #202 moves WriterWorker to a CF)
 *   --token <token>            Interview HMAC token (else uses DEV_LOGIN_SECRET
 *                              + dev-login to mint a session and read a fresh
 *                              consent cookie — not yet implemented; require
 *                              --token for the first cut)
 *   --help                     Print usage and exit 0
 *
 * Environment:
 *   DEV_LOGIN_SECRET           Required when --token is omitted. Kept out of
 *                              CLI args so it does not enter shell history.
 *
 * Exit codes:
 *   0   Both streams produced the same event sequence (after ignore-kinds)
 *   1   Sequences diverged
 *   2   Usage error / missing required input
 *   3   Transport error (HTTP non-200, network failure)
 */

import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export interface ParityCliOptions {
  baseUrl: string;
  interviewId: string;
  durationSeconds: number;
  ignoreKinds: Set<string>;
  token: string | undefined;
  help: boolean;
}

export const USAGE = `Usage:
  bun apps/web/scripts/stream-parity-smoke.ts --base-url <url> --interview-id <id> [options]

Required:
  --base-url <url>           Target host (e.g. https://blogbat.com)
  --interview-id <id>        Interview id to subscribe to

Options:
  --duration <seconds>       Capture window in seconds (default: 30)
  --ignore-kinds <a,b,c>     CSV of event kinds to drop before diffing
                             (default: writer_diff)
  --token <token>            Interview HMAC token. If omitted, reads
                             DEV_LOGIN_SECRET from env (not yet wired).
  --help                     Print this help and exit 0

Environment:
  DEV_LOGIN_SECRET           Required when --token is omitted.

Exit codes:
  0  parity OK
  1  divergence
  2  usage error
  3  transport error
`;

const DEFAULT_IGNORE_KINDS = new Set(["writer_diff"]);

export function parseParityCliArgs(argv: string[]): ParityCliOptions {
  let baseUrl = "";
  let interviewId = "";
  let durationSeconds = 30;
  let ignoreKinds = new Set(DEFAULT_IGNORE_KINDS);
  let token: string | undefined;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    const eqIdx = arg.indexOf("=");
    const key = eqIdx === -1 ? arg : arg.slice(0, eqIdx);
    const inlineValue = eqIdx === -1 ? undefined : arg.slice(eqIdx + 1);
    const value =
      inlineValue !== undefined ? inlineValue : (argv[i + 1] ?? "");
    const consumeNext = inlineValue === undefined;

    switch (key) {
      case "--base-url":
        baseUrl = value;
        if (consumeNext) i++;
        break;
      case "--interview-id":
        interviewId = value;
        if (consumeNext) i++;
        break;
      case "--duration": {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(
            `Invalid --duration value "${value}". Must be a positive number.`,
          );
        }
        durationSeconds = n;
        if (consumeNext) i++;
        break;
      }
      case "--ignore-kinds":
        ignoreKinds = new Set(
          value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
        if (consumeNext) i++;
        break;
      case "--token":
        token = value;
        if (consumeNext) i++;
        break;
      default:
        // Unknown — ignore so future flags don't break older callers.
        break;
    }
  }

  if (help) {
    return {
      baseUrl,
      interviewId,
      durationSeconds,
      ignoreKinds,
      token,
      help: true,
    };
  }

  if (!baseUrl) throw new Error("--base-url is required");
  if (!interviewId) throw new Error("--interview-id is required");
  if (baseUrl.endsWith("/")) {
    throw new Error("--base-url must not have a trailing slash");
  }

  return {
    baseUrl,
    interviewId,
    durationSeconds,
    ignoreKinds,
    token,
    help: false,
  };
}

export interface SseEvent {
  /** SSE `event:` field — `"message"` when omitted on the wire. */
  event: string;
  /** Parsed `data:` payload. JSON-decoded if it parses; otherwise raw string. */
  data: unknown;
}

/**
 * Parse an SSE stream chunk-by-chunk. Each frame is delimited by `\n\n`
 * (per the SSE spec). Lines starting with `:` are comments (keepalive) and
 * are discarded. Returns a flushable iterator interface so callers can feed
 * partial chunks and pull whole frames.
 */
export function createSseParser(): {
  feed: (chunk: string) => SseEvent[];
  flush: () => SseEvent[];
} {
  let buffer = "";

  function drainFrames(): SseEvent[] {
    const out: SseEvent[] = [];
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const parsed = parseFrame(frame);
      if (parsed) out.push(parsed);
      idx = buffer.indexOf("\n\n");
    }
    return out;
  }

  return {
    feed(chunk: string): SseEvent[] {
      buffer += chunk;
      return drainFrames();
    },
    flush(): SseEvent[] {
      if (!buffer) return [];
      const trailing = buffer;
      buffer = "";
      const parsed = parseFrame(trailing);
      return parsed ? [parsed] : [];
    },
  };
}

function parseFrame(frame: string): SseEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value =
      colon === -1
        ? ""
        : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }
  if (dataLines.length === 0 && event === "message") return null;
  const rawData = dataLines.join("\n");
  let data: unknown = rawData;
  if (rawData) {
    try {
      data = JSON.parse(rawData);
    } catch {
      // Leave as string if not JSON.
    }
  }
  return { event, data };
}

/**
 * Reduce an event to its identity for diffing. We compare by `event` field
 * and (if data is an object) the `kind` field — this matches the
 * Firestore-event shape both backends emit. Other payload fields (ts,
 * server-side ids) are intentionally ignored: parity here means "same
 * sequence of meaningful events", not byte-exact equality.
 */
export function eventIdentity(evt: SseEvent): string {
  const kind =
    evt.data && typeof evt.data === "object" && evt.data !== null
      ? (evt.data as { kind?: unknown }).kind
      : undefined;
  return typeof kind === "string" ? `${evt.event}:${kind}` : evt.event;
}

/**
 * Returns true when the event should be dropped before diffing — either
 * a known backend-specific kind, or the structural `hello` / `error`
 * frames that each backend may emit at different times for transport
 * reasons (the goal is to compare interview-level events, not transport
 * scaffolding).
 */
export function shouldIgnoreEvent(
  evt: SseEvent,
  ignoreKinds: Set<string>,
): boolean {
  if (evt.event === "hello" || evt.event === "error") return true;
  const kind =
    evt.data && typeof evt.data === "object" && evt.data !== null
      ? (evt.data as { kind?: unknown }).kind
      : undefined;
  if (typeof kind === "string" && ignoreKinds.has(kind)) return true;
  return false;
}

export interface DiffResult {
  ok: boolean;
  netlifyOnly: string[];
  gcpOnly: string[];
  commonLength: number;
}

/**
 * Compare two filtered event identity sequences.
 *
 * Parity does NOT require byte-identical ordering — Firestore listeners
 * coalesce changes differently across runtimes. We instead compare the
 * sorted multisets: every event that crossed Netlify should also have
 * crossed the CF, and vice versa, within the capture window.
 */
export function diffSequences(
  netlify: string[],
  gcp: string[],
): DiffResult {
  const netCounts = countBy(netlify);
  const gcpCounts = countBy(gcp);
  const netlifyOnly: string[] = [];
  const gcpOnly: string[] = [];
  const keys = new Set([...netCounts.keys(), ...gcpCounts.keys()]);
  for (const key of keys) {
    const n = netCounts.get(key) ?? 0;
    const g = gcpCounts.get(key) ?? 0;
    if (n > g) {
      for (let i = 0; i < n - g; i++) netlifyOnly.push(key);
    } else if (g > n) {
      for (let i = 0; i < g - n; i++) gcpOnly.push(key);
    }
  }
  let commonLength = 0;
  for (const key of keys) {
    commonLength += Math.min(netCounts.get(key) ?? 0, gcpCounts.get(key) ?? 0);
  }
  return {
    ok: netlifyOnly.length === 0 && gcpOnly.length === 0,
    netlifyOnly: netlifyOnly.sort(),
    gcpOnly: gcpOnly.sort(),
    commonLength,
  };
}

function countBy(items: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) out.set(item, (out.get(item) ?? 0) + 1);
  return out;
}

/**
 * Stream a single SSE endpoint until `signal` aborts or the connection
 * closes. Returns the collected events.
 */
export async function captureStream(args: {
  url: string;
  cookie: string;
  signal: AbortSignal;
}): Promise<SseEvent[]> {
  const events: SseEvent[] = [];
  const parser = createSseParser();
  const res = await fetch(args.url, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Cookie: args.cookie,
    },
    signal: args.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} from ${args.url}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      events.push(...parser.feed(chunk));
    }
  } catch (err) {
    // AbortError is expected when the timer fires — re-throw anything else.
    if (
      !(err instanceof Error) ||
      (err.name !== "AbortError" && !err.message.includes("aborted"))
    ) {
      throw err;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* lock already released */
    }
  }
  events.push(...parser.flush());
  return events;
}

async function main(argv: string[]): Promise<number> {
  let opts: ParityCliOptions;
  try {
    opts = parseParityCliArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }

  if (opts.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  if (!opts.token) {
    process.stderr.write(
      "error: --token is required (DEV_LOGIN_SECRET-based mint not yet wired)\n",
    );
    return 2;
  }

  const cookie = `interview_token_${opts.interviewId}=${opts.token}`;
  const netlifyUrl = `${opts.baseUrl}/api/v1/interviews/${opts.interviewId}/stream`;
  const gcpUrl = `${opts.baseUrl}/api/v1/interviews/${opts.interviewId}/stream-gcp`;

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts.durationSeconds * 1000,
  );

  process.stdout.write(
    `capturing ${opts.durationSeconds}s from\n  ${netlifyUrl}\n  ${gcpUrl}\n`,
  );

  let netlifyEvents: SseEvent[] = [];
  let gcpEvents: SseEvent[] = [];
  try {
    [netlifyEvents, gcpEvents] = await Promise.all([
      captureStream({ url: netlifyUrl, cookie, signal: controller.signal }),
      captureStream({ url: gcpUrl, cookie, signal: controller.signal }),
    ]);
  } catch (err) {
    clearTimeout(timer);
    process.stderr.write(`transport error: ${(err as Error).message}\n`);
    return 3;
  }
  clearTimeout(timer);

  const filteredNetlify = netlifyEvents
    .filter((e) => !shouldIgnoreEvent(e, opts.ignoreKinds))
    .map(eventIdentity);
  const filteredGcp = gcpEvents
    .filter((e) => !shouldIgnoreEvent(e, opts.ignoreKinds))
    .map(eventIdentity);

  const diff = diffSequences(filteredNetlify, filteredGcp);

  process.stdout.write(
    `\nnetlify events: ${netlifyEvents.length} captured, ${filteredNetlify.length} after filter\n`,
  );
  process.stdout.write(
    `gcp events:     ${gcpEvents.length} captured, ${filteredGcp.length} after filter\n`,
  );
  process.stdout.write(
    `common:         ${diff.commonLength}\n`,
  );

  if (!diff.ok) {
    process.stdout.write(`\nDIVERGENCE DETECTED:\n`);
    if (diff.netlifyOnly.length > 0) {
      process.stdout.write(`  Netlify-only (${diff.netlifyOnly.length}):\n`);
      for (const id of diff.netlifyOnly) process.stdout.write(`    ${id}\n`);
    }
    if (diff.gcpOnly.length > 0) {
      process.stdout.write(`  GCP-only (${diff.gcpOnly.length}):\n`);
      for (const id of diff.gcpOnly) process.stdout.write(`    ${id}\n`);
    }
    return 1;
  }

  process.stdout.write(`\nPARITY OK\n`);
  return 0;
}

// Only auto-run when invoked as the entry point. Importing this file from a
// test must NOT execute main().
const isDirectInvocation =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectInvocation) {
  void main(process.argv.slice(2)).then((code) => process.exit(code));
}
