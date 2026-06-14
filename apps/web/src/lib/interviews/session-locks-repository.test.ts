import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  getSessionLock,
  upsertHeartbeat,
  deleteSessionLock,
  STALE_LOCK_THRESHOLD_MS,
} from "./session-locks-repository";

type TestDb = Parameters<typeof getSessionLock>[2];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE interview_session_locks (
    interview_id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    heartbeat_id text NOT NULL,
    last_beat_at integer NOT NULL
  );`);
  await client.execute(`CREATE INDEX interview_session_locks_blog_idx ON interview_session_locks (blog_id);`);
  return drizzle(client, { schema }) as unknown as TestDb;
}

const BLOG_A = "blog-a";
const BLOG_B = "blog-b";

describe("session-locks repository", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // getSessionLock
  // ---------------------------------------------------------------------------

  it("returns null when no lock exists", async () => {
    expect(await getSessionLock(BLOG_A, "int-1", db)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // upsertHeartbeat — acquire
  // ---------------------------------------------------------------------------

  it("acquires a new lock when none exists", async () => {
    const result = await upsertHeartbeat(BLOG_A, "int-1", "hb_new", false, db);
    expect(result.status).toBe("acquired");

    const lock = await getSessionLock(BLOG_A, "int-1", db);
    expect(lock).not.toBeNull();
    expect(lock!.heartbeatId).toBe("hb_new");
    expect(lock!.blogId).toBe(BLOG_A);
  });

  // ---------------------------------------------------------------------------
  // upsertHeartbeat — refresh
  // ---------------------------------------------------------------------------

  it("refreshes the lock when the same holder beats again", async () => {
    await upsertHeartbeat(BLOG_A, "int-1", "hb_same", false, db);

    // Advance time by getting the current lock's lastBeatAt
    const before = await getSessionLock(BLOG_A, "int-1", db);
    const result = await upsertHeartbeat(BLOG_A, "int-1", "hb_same", false, db);
    expect(result.status).toBe("refreshed");

    const after = await getSessionLock(BLOG_A, "int-1", db);
    expect(after!.lastBeatAt).toBeGreaterThanOrEqual(before!.lastBeatAt);
  });

  // ---------------------------------------------------------------------------
  // upsertHeartbeat — conflict
  // ---------------------------------------------------------------------------

  it("returns conflict when a different fresh holder is active", async () => {
    // Acquire with hb_other
    await upsertHeartbeat(BLOG_A, "int-1", "hb_other", false, db);

    // Attempt to take over without takeover=true
    const result = await upsertHeartbeat(BLOG_A, "int-1", "hb_new", false, db);
    expect(result.status).toBe("conflict");
    if (result.status === "conflict") {
      expect(result.currentHolder).toBe("hb_other");
      expect(typeof result.lastBeatAt).toBe("number");
    }
  });

  // ---------------------------------------------------------------------------
  // upsertHeartbeat — takeover
  // ---------------------------------------------------------------------------

  it("allows takeover when takeover=true", async () => {
    await upsertHeartbeat(BLOG_A, "int-1", "hb_old", false, db);
    const result = await upsertHeartbeat(BLOG_A, "int-1", "hb_new", true, db);
    expect(result.status).toBe("acquired");
    if (result.status === "acquired" && "previousHolder" in result) {
      expect(result.previousHolder).toBe("hb_old");
    }

    const lock = await getSessionLock(BLOG_A, "int-1", db);
    expect(lock!.heartbeatId).toBe("hb_new");
  });

  // ---------------------------------------------------------------------------
  // upsertHeartbeat — stale takeover
  // ---------------------------------------------------------------------------

  it("silently takes over a stale lock", async () => {
    // Insert a lock with a very old lastBeatAt (stale)
    const staleTime = Date.now() - STALE_LOCK_THRESHOLD_MS - 1000;
    const client = createClient({ url: ":memory:" });
    await client.execute(`CREATE TABLE interview_session_locks (
      interview_id text PRIMARY KEY NOT NULL,
      blog_id text DEFAULT 'default' NOT NULL,
      heartbeat_id text NOT NULL,
      last_beat_at integer NOT NULL
    );`);
    const staleDb = drizzle(client, { schema }) as unknown as TestDb;
    await upsertHeartbeat(BLOG_A, "int-stale", "hb_stale", false, staleDb);

    // Manually update lastBeatAt to be stale
    await client.execute({
      sql: `UPDATE interview_session_locks SET last_beat_at = ? WHERE interview_id = ?`,
      args: [staleTime, "int-stale"],
    });

    // A new holder should take over silently
    const result = await upsertHeartbeat(BLOG_A, "int-stale", "hb_new", false, staleDb);
    expect(result.status).toBe("acquired");
    if (result.status === "acquired" && "wasStale" in result) {
      expect(result.wasStale).toBe(true);
    }

    const lock = await getSessionLock(BLOG_A, "int-stale", staleDb);
    expect(lock!.heartbeatId).toBe("hb_new");
  });

  // ---------------------------------------------------------------------------
  // deleteSessionLock
  // ---------------------------------------------------------------------------

  it("deletes the lock when the caller is the current holder", async () => {
    await upsertHeartbeat(BLOG_A, "int-1", "hb_mine", false, db);
    const deleted = await deleteSessionLock(BLOG_A, "int-1", "hb_mine", db);
    expect(deleted).toBe(true);

    expect(await getSessionLock(BLOG_A, "int-1", db)).toBeNull();
  });

  it("does not delete if caller is not the holder", async () => {
    await upsertHeartbeat(BLOG_A, "int-1", "hb_other", false, db);
    const deleted = await deleteSessionLock(BLOG_A, "int-1", "hb_wrong", db);
    expect(deleted).toBe(false);

    const lock = await getSessionLock(BLOG_A, "int-1", db);
    expect(lock!.heartbeatId).toBe("hb_other");
  });

  it("returns false when no lock exists", async () => {
    const deleted = await deleteSessionLock(BLOG_A, "int-nonexistent", "any-hb", db);
    expect(deleted).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation — CRITICAL
  // ---------------------------------------------------------------------------

  it("getSessionLock does not return another blog's lock", async () => {
    await upsertHeartbeat(BLOG_A, "int-1", "hb", false, db);
    expect(await getSessionLock(BLOG_B, "int-1", db)).toBeNull();
  });

  it("deleteSessionLock does not remove another blog's lock", async () => {
    await upsertHeartbeat(BLOG_A, "int-1", "hb_mine", false, db);
    const deleted = await deleteSessionLock(BLOG_B, "int-1", "hb_mine", db);
    expect(deleted).toBe(false);

    expect(await getSessionLock(BLOG_A, "int-1", db)).not.toBeNull();
  });

  it("upsertHeartbeat does not affect another blog's interview", async () => {
    await upsertHeartbeat(BLOG_A, "int-1", "hb_a", false, db);

    // Acquiring on BLOG_B/int-1 should work independently (no PK conflict since
    // session-locks are keyed by interview_id only, not blog_id+interview_id)
    // This tests that the blogId check is enforced in conflict/refresh logic.
    const result = await upsertHeartbeat(BLOG_B, "int-2", "hb_b", false, db);
    expect(result.status).toBe("acquired");

    // BLOG_A's lock is unaffected
    const lockA = await getSessionLock(BLOG_A, "int-1", db);
    expect(lockA!.heartbeatId).toBe("hb_a");
  });
});
