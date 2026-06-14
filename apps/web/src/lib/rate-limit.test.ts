import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

// `checkRateLimit` calls `getDb()` internally; the mock lets each test inject a
// fresh in-memory libsql instance (or a broken one for the fail-open case).
const dbRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({
  getDb: () => dbRef.current,
}));

import { checkRateLimit, RATE_LIMIT_WINDOW_MS } from "./rate-limit";

async function makeDb() {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE rate_limits (
    id text PRIMARY KEY NOT NULL,
    bucket text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    window_start integer NOT NULL,
    expires_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE UNIQUE INDEX rate_limits_bucket_idx ON rate_limits (bucket);`,
  );
  return drizzle(client, { schema });
}

describe("checkRateLimit (D1 fixed-window)", () => {
  beforeEach(async () => {
    dbRef.current = await makeDb();
  });

  it("allows requests up to maxPerMinute", async () => {
    const now = 1_000_000;
    const args = { key: "interview-magic-link", ip: "1.2.3.4", maxPerMinute: 3, now };

    const r1 = await checkRateLimit(args);
    const r2 = await checkRateLimit(args);
    const r3 = await checkRateLimit(args);

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks once the count exceeds maxPerMinute and reports retryAfter via resetAt", async () => {
    const now = 1_000_000;
    const args = { key: "interview-magic-link", ip: "1.2.3.4", maxPerMinute: 2, now };

    await checkRateLimit(args);
    await checkRateLimit(args);
    const blocked = await checkRateLimit(args);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    // resetAt is the end of the current minute window — the source for the
    // Retry-After header computed in create-api-handler.
    const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
    expect(blocked.resetAt).toBe(windowStart + RATE_LIMIT_WINDOW_MS);
    expect(blocked.resetAt).toBeGreaterThan(now);
  });

  it("resets in the next window (a new minute starts a fresh count)", async () => {
    const base = 1_000_000;
    const args = { key: "interview-consent", ip: "5.6.7.8", maxPerMinute: 1 };

    expect((await checkRateLimit({ ...args, now: base })).allowed).toBe(true);
    expect((await checkRateLimit({ ...args, now: base })).allowed).toBe(false);

    // Advance past the window boundary → a new bucket, count resets.
    const next = base + RATE_LIMIT_WINDOW_MS;
    expect((await checkRateLimit({ ...args, now: next })).allowed).toBe(true);
  });

  it("isolates buckets per key and per IP", async () => {
    const now = 2_000_000;
    expect(
      (await checkRateLimit({ key: "a", ip: "1.1.1.1", maxPerMinute: 1, now }))
        .allowed,
    ).toBe(true);
    // Same key, different IP → separate bucket, still allowed.
    expect(
      (await checkRateLimit({ key: "a", ip: "2.2.2.2", maxPerMinute: 1, now }))
        .allowed,
    ).toBe(true);
    // Different key, same IP → separate bucket, still allowed.
    expect(
      (await checkRateLimit({ key: "b", ip: "1.1.1.1", maxPerMinute: 1, now }))
        .allowed,
    ).toBe(true);
  });

  it("fails OPEN on a DB error (never blocks legitimate traffic)", async () => {
    dbRef.current = {
      insert: () => {
        throw new Error("db down");
      },
    };
    const now = 3_000_000;
    const result = await checkRateLimit({
      key: "interview-magic-link",
      ip: "1.2.3.4",
      maxPerMinute: 1,
      now,
    });

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(1);
    expect(result.remaining).toBe(1);
  });
});
