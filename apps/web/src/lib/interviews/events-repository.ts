import "server-only";

import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { interviewEvents } from "@/db/schema/interviews";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:interviews:events-repository");

type DB = DrizzleD1Database<typeof schema>;
type Row = typeof interviewEvents.$inferSelect;

// ---------------------------------------------------------------------------
// Validation caps — mirrored from the events route (F-008).
// These are applied at INSERT time so the database never contains data that
// would exceed the caps even if the route-level validation is ever bypassed.
// ---------------------------------------------------------------------------

const TRANSCRIPT_TEXT_MAX = 8_000;
const CHAT_INPUT_TEXT_MAX = 4_000;
const TOOL_CALL_ARGS_MAX = 4_000;

/**
 * Clamp a string to a maximum length. Returns the original string when it is
 * within bounds to avoid allocating a new string unnecessarily.
 */
function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Sanitise and clamp payload fields per the F-008 per-field caps before
 * persisting. The route-level Zod schema rejects values that exceed the caps,
 * but writer-worker events bypass the route and call `appendEvents` directly,
 * so we apply the same floor here as a belt-and-braces guard.
 */
function sanitisePayload(kind: string, payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) return payload;
  const p = payload as Record<string, unknown>;

  if (kind === "transcript_user" || kind === "transcript_ai") {
    if (typeof p.text === "string") {
      return { ...p, text: clamp(p.text, TRANSCRIPT_TEXT_MAX) };
    }
  }
  if (kind === "chat_input") {
    if (typeof p.text === "string") {
      return { ...p, text: clamp(p.text, CHAT_INPUT_TEXT_MAX) };
    }
  }
  if (kind === "tool_call") {
    const args = p.arguments;
    if (typeof args === "string") {
      return { ...p, arguments: clamp(args, TOOL_CALL_ARGS_MAX) };
    }
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface InterviewEventRow {
  id: string;
  blogId: string;
  interviewId: string;
  kind: string;
  ts: string;
  payload: unknown;
  createdAt: number;
}

function toRow(row: Row): InterviewEventRow {
  return {
    id: row.id,
    blogId: row.blogId,
    interviewId: row.interviewId,
    kind: row.kind,
    ts: row.ts,
    payload: JSON.parse(row.payload) as unknown,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export type EventInput = {
  kind: string;
  ts: string;
  payload: unknown;
};

/**
 * Atomically batch-insert a slice of events for an interview.
 *
 * Uses `db.batch` so all inserts land in a single Cloudflare D1 HTTP round
 * trip. If any row conflicts on the primary key (nanoid collision — p≈10⁻²¹
 * for 21-char ids) the entire batch is rolled back and callers can retry.
 *
 * Payload fields are sanitised/clamped per the F-008 caps before storage so
 * the database is always in a valid state regardless of the call site.
 */
export async function appendEvents(
  blogId: string,
  interviewId: string,
  events: EventInput[],
  db: DB = getDb(),
): Promise<void> {
  if (events.length === 0) return;

  const now = Date.now();

  const inserts = events.map((ev) => {
    const cleanPayload = sanitisePayload(ev.kind, ev.payload);
    return db.insert(interviewEvents).values({
      id: nanoid(),
      blogId,
      interviewId,
      kind: ev.kind,
      ts: ev.ts,
      payload: JSON.stringify(cleanPayload),
      createdAt: now,
    });
  });

  // D1's batch API executes all statements in a single HTTP request and
  // wraps them in an implicit transaction — either all rows land or none do.
  await db.batch(inserts as [typeof inserts[0], ...typeof inserts]);

  log.info("events:append", { blogId, interviewId, count: events.length });
}

// ---------------------------------------------------------------------------
// Read — polling query (SSE stream)
// ---------------------------------------------------------------------------

/**
 * Compound cursor for `listEventsSince`.
 *
 * Using only `ts` as a cursor is unsafe when multiple events share the same
 * millisecond-precision ISO-8601 timestamp (e.g. a burst from a tool batch).
 * A `ts >` filter would re-emit the events at the shared millisecond from the
 * previous poll, and a `ts >=` filter would drop them from the next poll.
 *
 * The compound cursor (afterTs, afterId) avoids both problems:
 *
 *   WHERE (ts > afterTs) OR (ts = afterTs AND id > afterId)
 *
 * This advances past the exact (ts, id) position so no event is dropped or
 * duplicated even when events share a ts value. The secondary `id` column is
 * lexicographically sortable (nanoid) so the tie-breaking direction is stable.
 */
export type EventCursor = {
  afterTs: string;
  afterId: string;
};

/**
 * Fetch events for an interview in chronological order, optionally filtered
 * by kind and/or positioned after a compound (ts, id) cursor.
 *
 * @param blogId     - tenant scope
 * @param interviewId - interview scope
 * @param opts.cursor - compound (ts, id) cursor from the previous poll; events
 *                      strictly after this position are returned. Omit for the
 *                      initial query.
 * @param opts.kinds  - optional kind allowlist (maps to the SSE STREAM_KINDS)
 * @param opts.limit  - max rows per call (default 200)
 * @param db          - optional injected DB (for tests)
 */
export async function listEventsSince(
  blogId: string,
  interviewId: string,
  opts: { cursor?: EventCursor; kinds?: string[]; limit?: number } = {},
  db: DB = getDb(),
): Promise<InterviewEventRow[]> {
  const limit = opts.limit ?? 200;

  // Base conditions: always scope to blog + interview.
  const baseConditions = [
    eq(interviewEvents.blogId, blogId),
    eq(interviewEvents.interviewId, interviewId),
  ];

  // Kind filter.
  if (opts.kinds && opts.kinds.length > 0) {
    baseConditions.push(inArray(interviewEvents.kind, opts.kinds));
  }

  // Compound cursor: (ts > afterTs) OR (ts = afterTs AND id > afterId).
  // This gives a stable total order even when events share a millisecond ts
  // — no event is dropped or double-emitted across poll boundaries.
  //
  // When afterId is "" (the seed value used after a Last-Event-ID resume where
  // only the ts is known), the id comparison cannot be used as a tiebreaker
  // because every real id (nanoid) would match `id > ""`. In that case we use
  // only `ts > afterTs` which is slightly over-conservative at the boundary
  // ms (could miss same-ms events with the same ts but different ids), but the
  // SSE client deduplicates by event id so a rare over-skip is safer than
  // emitting duplicates on reconnect.
  let rows: Row[];
  if (opts.cursor) {
    const { afterTs, afterId } = opts.cursor;
    const cursorCondition = afterId
      ? or(
          gt(interviewEvents.ts, afterTs),
          and(
            eq(interviewEvents.ts, afterTs),
            gt(interviewEvents.id, afterId),
          ),
        )
      : gt(interviewEvents.ts, afterTs);
    rows = await db
      .select()
      .from(interviewEvents)
      .where(and(...baseConditions, cursorCondition))
      .orderBy(asc(interviewEvents.ts), asc(interviewEvents.id))
      .limit(limit);
  } else {
    rows = await db
      .select()
      .from(interviewEvents)
      .where(and(...baseConditions))
      .orderBy(asc(interviewEvents.ts), asc(interviewEvents.id))
      .limit(limit);
  }

  return rows.map(toRow);
}

// ---------------------------------------------------------------------------
// Read — full history (aggregate-usage, cost cap)
// ---------------------------------------------------------------------------

/**
 * Return all events for an interview, optionally filtered by kind.
 *
 * Used by `aggregateUsage` and `computeServerAuthoritativeUsage` to sum token
 * usage across the full session. Not paginated — the caller is responsible for
 * keeping the event count reasonable (enforced upstream by the per-batch rate
 * limit and byte cap on the events POST route).
 */
export async function listAllEvents(
  blogId: string,
  interviewId: string,
  opts: { kinds?: string[] } = {},
  db: DB = getDb(),
): Promise<InterviewEventRow[]> {
  const conditions = [
    eq(interviewEvents.blogId, blogId),
    eq(interviewEvents.interviewId, interviewId),
  ];

  if (opts.kinds && opts.kinds.length > 0) {
    conditions.push(inArray(interviewEvents.kind, opts.kinds));
  }

  const rows = await db
    .select()
    .from(interviewEvents)
    .where(and(...conditions))
    .orderBy(asc(interviewEvents.ts), asc(interviewEvents.id));

  return rows.map(toRow);
}

// ---------------------------------------------------------------------------
// Read — token usage aggregation (server-authoritative cost cap, F-003)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Count — interview_events per interview (diagnostics)
// ---------------------------------------------------------------------------

export async function countEvents(
  blogId: string,
  interviewId: string,
  db: DB = getDb(),
): Promise<number> {
  const result = await db
    .select({ n: sql<number>`count(*)` })
    .from(interviewEvents)
    .where(
      and(
        eq(interviewEvents.blogId, blogId),
        eq(interviewEvents.interviewId, interviewId),
      ),
    );
  return (result[0]?.n ?? 0) as number;
}
