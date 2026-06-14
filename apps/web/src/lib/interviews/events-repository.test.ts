import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import {
  appendEvents,
  listEventsSince,
  listAllEvents,
  countEvents,
} from "./events-repository";

type TestDb = Parameters<typeof appendEvents>[3];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE interview_events (
    id text PRIMARY KEY NOT NULL,
    blog_id text NOT NULL,
    interview_id text NOT NULL,
    kind text NOT NULL,
    ts text NOT NULL,
    payload text NOT NULL,
    created_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX interview_events_blog_iv_ts_idx ON interview_events (blog_id, interview_id, ts);`,
  );
  await client.execute(
    `CREATE INDEX interview_events_blog_iv_kind_ts_idx ON interview_events (blog_id, interview_id, kind, ts);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

const BLOG_A = "blog-a";
const BLOG_B = "blog-b";
const IV_1 = "interview-1";
const IV_2 = "interview-2";

describe("events-repository", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // appendEvents
  // ---------------------------------------------------------------------------

  it("inserts a batch of events and returns them via listAllEvents", async () => {
    await appendEvents(
      BLOG_A,
      IV_1,
      [
        { kind: "transcript_user", ts: "2026-05-01T00:00:00.000Z", payload: { text: "hello" } },
        { kind: "transcript_ai", ts: "2026-05-01T00:00:01.000Z", payload: { text: "world" } },
      ],
      db,
    );

    const rows = await listAllEvents(BLOG_A, IV_1, {}, db);
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe("transcript_user");
    expect(rows[0].payload).toEqual({ text: "hello" });
    expect(rows[1].kind).toBe("transcript_ai");
  });

  it("preserves JSON payload round-trip", async () => {
    const payload = { text: "hi", usage: { input_tokens: 10, output_tokens: 5 }, nested: { a: [1, 2, 3] } };
    await appendEvents(BLOG_A, IV_1, [{ kind: "transcript_ai", ts: "2026-05-01T00:00:00.000Z", payload }], db);

    const [row] = await listAllEvents(BLOG_A, IV_1, {}, db);
    expect(row.payload).toEqual(payload);
  });

  it("returns empty array when no events exist", async () => {
    const rows = await listAllEvents(BLOG_A, IV_1, {}, db);
    expect(rows).toHaveLength(0);
  });

  it("is a no-op when the events array is empty", async () => {
    await appendEvents(BLOG_A, IV_1, [], db);
    expect(await countEvents(BLOG_A, IV_1, db)).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // listEventsSince — cursor + kinds filter
  // ---------------------------------------------------------------------------

  it("returns events strictly after afterTs", async () => {
    await appendEvents(BLOG_A, IV_1, [
      { kind: "writer_diff", ts: "2026-05-01T00:00:01.000Z", payload: {} },
      { kind: "writer_diff", ts: "2026-05-01T00:00:02.000Z", payload: {} },
      { kind: "writer_diff", ts: "2026-05-01T00:00:03.000Z", payload: {} },
    ], db);

    const rows = await listEventsSince(BLOG_A, IV_1, {
      cursor: { afterTs: "2026-05-01T00:00:01.000Z", afterId: "" },
    }, db);

    // Only the two events strictly after the cursor ts (>)
    expect(rows).toHaveLength(2);
    expect(rows[0].ts).toBe("2026-05-01T00:00:02.000Z");
    expect(rows[1].ts).toBe("2026-05-01T00:00:03.000Z");
  });

  it("filters by kinds", async () => {
    await appendEvents(BLOG_A, IV_1, [
      { kind: "transcript_user", ts: "2026-05-01T00:00:01.000Z", payload: {} },
      { kind: "writer_diff", ts: "2026-05-01T00:00:02.000Z", payload: {} },
      { kind: "canvas_update", ts: "2026-05-01T00:00:03.000Z", payload: {} },
    ], db);

    const rows = await listEventsSince(BLOG_A, IV_1, {
      kinds: ["writer_diff", "canvas_update"],
    }, db);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.kind)).toEqual(["writer_diff", "canvas_update"]);
  });

  it("returns all events when no cursor and no kinds filter", async () => {
    await appendEvents(BLOG_A, IV_1, [
      { kind: "transcript_user", ts: "2026-05-01T00:00:01.000Z", payload: {} },
      { kind: "transcript_ai", ts: "2026-05-01T00:00:02.000Z", payload: {} },
    ], db);

    const rows = await listEventsSince(BLOG_A, IV_1, {}, db);
    expect(rows).toHaveLength(2);
  });

  it("respects the limit parameter", async () => {
    await appendEvents(BLOG_A, IV_1, [
      { kind: "writer_diff", ts: "2026-05-01T00:00:01.000Z", payload: {} },
      { kind: "writer_diff", ts: "2026-05-01T00:00:02.000Z", payload: {} },
      { kind: "writer_diff", ts: "2026-05-01T00:00:03.000Z", payload: {} },
    ], db);

    const rows = await listEventsSince(BLOG_A, IV_1, { limit: 2 }, db);
    expect(rows).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // Compound cursor correctness — same-millisecond ts tiebreaker
  // ---------------------------------------------------------------------------
  //
  // This is the #1 correctness risk in the polling path. When multiple events
  // share the exact same ISO-8601 ts (same millisecond), a simple `ts >`
  // cursor would either:
  //   - drop events at the shared ms (if the next poll uses `ts > lastTs`)
  //   - double-emit events (if using `ts >= lastTs`)
  //
  // The compound cursor (ts, id) with the OR predicate
  //   WHERE (ts > afterTs) OR (ts = afterTs AND id > afterId)
  // advances past the exact (ts, id) position, preventing both outcomes.
  //
  // This test simulates a two-step poll where events 1+2 share a ts value and
  // event 3 has a later ts. Poll 1 delivers event 1. Poll 2 (using the cursor
  // from event 1) must deliver event 2 (same ts, later id) and event 3
  // (later ts), with NO duplication of event 1.

  it("same-millisecond ts: no event is dropped or duplicated across poll boundaries", async () => {
    const sharedTs = "2026-05-22T17:51:28.453Z";
    const laterTs = "2026-05-22T17:51:29.000Z";

    // Insert 3 events: two at the same ms, one later.
    await appendEvents(BLOG_A, IV_1, [
      { kind: "writer_diff", ts: sharedTs, payload: { seq: 1 } },
      { kind: "writer_diff", ts: sharedTs, payload: { seq: 2 } },
      { kind: "writer_diff", ts: laterTs, payload: { seq: 3 } },
    ], db);

    // Fetch all to know their stable ids.
    const all = await listEventsSince(BLOG_A, IV_1, {}, db);
    expect(all).toHaveLength(3);

    // Poll 1: no cursor — should return all 3 ordered by (ts, id).
    const poll1 = await listEventsSince(BLOG_A, IV_1, { limit: 1 }, db);
    expect(poll1).toHaveLength(1);
    const firstEvent = poll1[0];
    // Must be the first event at sharedTs (lowest id among same-ts events).
    expect(firstEvent.ts).toBe(sharedTs);

    // Poll 2: cursor from the last event in poll 1.
    const cursor2 = { afterTs: firstEvent.ts, afterId: firstEvent.id };
    const poll2 = await listEventsSince(BLOG_A, IV_1, { cursor: cursor2 }, db);
    // Must return the remaining 2 events (the second at sharedTs + the laterTs one).
    expect(poll2).toHaveLength(2);

    // The first returned in poll 2 must be at sharedTs with a different id.
    expect(poll2[0].ts).toBe(sharedTs);
    expect(poll2[0].id).not.toBe(firstEvent.id);
    // The second must be the laterTs event.
    expect(poll2[1].ts).toBe(laterTs);

    // Assert NO duplicates across all polls combined.
    const allIds = [firstEvent.id, ...poll2.map((r) => r.id)];
    expect(new Set(allIds).size).toBe(3);

    // Assert ALL 3 events were delivered exactly once.
    const seqs = [firstEvent, ...poll2].map((r) => (r.payload as { seq: number }).seq).sort();
    expect(seqs).toEqual([1, 2, 3]);
  });

  it("same-millisecond ts: a poll that straddles the boundary returns no duplicates", async () => {
    // Two events with identical ts inserted in the same batch.
    const ts = "2026-05-22T17:51:28.453Z";
    await appendEvents(BLOG_A, IV_1, [
      { kind: "canvas_update", ts, payload: { n: 1 } },
      { kind: "canvas_update", ts, payload: { n: 2 } },
    ], db);

    // Poll 1: get first event only.
    const poll1 = await listEventsSince(BLOG_A, IV_1, { limit: 1 }, db);
    expect(poll1).toHaveLength(1);

    // Poll 2: advance cursor. Must return the second event, not both.
    const poll2 = await listEventsSince(BLOG_A, IV_1, {
      cursor: { afterTs: poll1[0].ts, afterId: poll1[0].id },
    }, db);
    expect(poll2).toHaveLength(1);
    expect(poll2[0].id).not.toBe(poll1[0].id);

    // Total: 2 distinct events.
    expect(new Set([poll1[0].id, poll2[0].id]).size).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation — CRITICAL
  // ---------------------------------------------------------------------------

  it("listAllEvents does not return another blog's events", async () => {
    await appendEvents(BLOG_A, IV_1, [{ kind: "transcript_user", ts: "2026-05-01T00:00:01.000Z", payload: {} }], db);
    const rows = await listAllEvents(BLOG_B, IV_1, {}, db);
    expect(rows).toHaveLength(0);
  });

  it("listEventsSince does not return another blog's events", async () => {
    await appendEvents(BLOG_A, IV_1, [{ kind: "writer_diff", ts: "2026-05-01T00:00:01.000Z", payload: {} }], db);
    const rows = await listEventsSince(BLOG_B, IV_1, {}, db);
    expect(rows).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Interview isolation
  // ---------------------------------------------------------------------------

  it("listAllEvents does not return another interview's events", async () => {
    await appendEvents(BLOG_A, IV_1, [{ kind: "transcript_user", ts: "2026-05-01T00:00:01.000Z", payload: {} }], db);
    const rows = await listAllEvents(BLOG_A, IV_2, {}, db);
    expect(rows).toHaveLength(0);
  });

  it("listEventsSince does not return another interview's events", async () => {
    await appendEvents(BLOG_A, IV_1, [{ kind: "writer_diff", ts: "2026-05-01T00:00:01.000Z", payload: {} }], db);
    const rows = await listEventsSince(BLOG_A, IV_2, {}, db);
    expect(rows).toHaveLength(0);
  });

  it("events from different interviews coexist without leaking", async () => {
    await appendEvents(BLOG_A, IV_1, [{ kind: "transcript_user", ts: "2026-05-01T00:00:01.000Z", payload: { who: "iv1" } }], db);
    await appendEvents(BLOG_A, IV_2, [{ kind: "transcript_user", ts: "2026-05-01T00:00:01.000Z", payload: { who: "iv2" } }], db);

    const iv1rows = await listAllEvents(BLOG_A, IV_1, {}, db);
    const iv2rows = await listAllEvents(BLOG_A, IV_2, {}, db);

    expect(iv1rows).toHaveLength(1);
    expect((iv1rows[0].payload as { who: string }).who).toBe("iv1");
    expect(iv2rows).toHaveLength(1);
    expect((iv2rows[0].payload as { who: string }).who).toBe("iv2");
  });

  // ---------------------------------------------------------------------------
  // Ordering
  // ---------------------------------------------------------------------------

  it("returns events ordered by ts ASC, id ASC", async () => {
    // Insert in reverse order to verify ordering is by ts not insertion order.
    await appendEvents(BLOG_A, IV_1, [
      { kind: "writer_diff", ts: "2026-05-01T00:00:03.000Z", payload: { n: 3 } },
      { kind: "writer_diff", ts: "2026-05-01T00:00:01.000Z", payload: { n: 1 } },
      { kind: "writer_diff", ts: "2026-05-01T00:00:02.000Z", payload: { n: 2 } },
    ], db);

    const rows = await listAllEvents(BLOG_A, IV_1, {}, db);
    const seqs = rows.map((r) => (r.payload as { n: number }).n);
    expect(seqs).toEqual([1, 2, 3]);
  });

  // ---------------------------------------------------------------------------
  // listAllEvents kinds filter
  // ---------------------------------------------------------------------------

  it("listAllEvents with kinds filter returns only matching kinds", async () => {
    await appendEvents(BLOG_A, IV_1, [
      { kind: "transcript_user", ts: "2026-05-01T00:00:01.000Z", payload: {} },
      { kind: "writer_update", ts: "2026-05-01T00:00:02.000Z", payload: {} },
      { kind: "canvas_update", ts: "2026-05-01T00:00:03.000Z", payload: {} },
    ], db);

    const rows = await listAllEvents(BLOG_A, IV_1, {
      kinds: ["transcript_user", "writer_update"],
    }, db);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.kind)).toEqual(["transcript_user", "writer_update"]);
  });

  // ---------------------------------------------------------------------------
  // countEvents
  // ---------------------------------------------------------------------------

  it("countEvents returns 0 for an empty interview", async () => {
    expect(await countEvents(BLOG_A, IV_1, db)).toBe(0);
  });

  it("countEvents returns the correct count after appending events", async () => {
    await appendEvents(BLOG_A, IV_1, [
      { kind: "transcript_user", ts: "2026-05-01T00:00:01.000Z", payload: {} },
      { kind: "writer_diff", ts: "2026-05-01T00:00:02.000Z", payload: {} },
    ], db);
    expect(await countEvents(BLOG_A, IV_1, db)).toBe(2);
  });

  it("countEvents is scoped to blog + interview", async () => {
    await appendEvents(BLOG_A, IV_1, [{ kind: "writer_diff", ts: "2026-05-01T00:00:01.000Z", payload: {} }], db);
    expect(await countEvents(BLOG_B, IV_1, db)).toBe(0);
    expect(await countEvents(BLOG_A, IV_2, db)).toBe(0);
  });
});
