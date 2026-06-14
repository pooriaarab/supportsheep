import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  getFreeToolUsageDayKey,
  hashFreeToolUsageSubject,
  incrementFreeToolUsage,
} from "./usage-limiter";

// ---------------------------------------------------------------------------
// In-memory SQLite setup (real drizzle queries)
// ---------------------------------------------------------------------------

type TestDb = Parameters<typeof incrementFreeToolUsage>[2];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE free_tool_usage (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    tool_id text NOT NULL,
    day text NOT NULL,
    subject_hash text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    first_used_at integer NOT NULL,
    last_used_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX free_tool_usage_blog_idx ON free_tool_usage (blog_id);`,
  );
  await client.execute(
    `CREATE UNIQUE INDEX free_tool_usage_lookup_idx ON free_tool_usage (blog_id, tool_id, subject_hash, day);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

const TEST_HASH_SECRET = "test-hash-input-with-at-least-32-chars";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("free tool usage limiter", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  // -------------------------------------------------------------------------
  // getFreeToolUsageDayKey
  // -------------------------------------------------------------------------

  it("builds stable UTC day keys", () => {
    expect(getFreeToolUsageDayKey(new Date("2026-04-25T23:59:59.000Z"))).toBe("20260425");
  });

  // -------------------------------------------------------------------------
  // hashFreeToolUsageSubject
  // -------------------------------------------------------------------------

  it("hashes IP, user agent, day, and tool ID without returning raw subject values", () => {
    const hash = hashFreeToolUsageSubject({
      ip: "203.0.113.10",
      userAgent: "Vitest",
      secret: TEST_HASH_SECRET,
      day: "20260425",
      toolId: "word-counter",
    });

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("203.0.113.10");

    // Stable: same inputs → same hash
    expect(hash).toBe(
      hashFreeToolUsageSubject({
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        day: "20260425",
        toolId: "word-counter",
      }),
    );

    // Different tool → different hash
    expect(hash).not.toBe(
      hashFreeToolUsageSubject({
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        day: "20260425",
        toolId: "blog-outline-generator",
      }),
    );

    // Different day → different hash
    expect(hash).not.toBe(
      hashFreeToolUsageSubject({
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        day: "20260426",
        toolId: "word-counter",
      }),
    );
  });

  it("rejects weak usage hash secrets", () => {
    expect(() =>
      hashFreeToolUsageSubject({
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: "short",
        day: "20260425",
        toolId: "word-counter",
      }),
    ).toThrow("Free tool usage hash secret must be at least 32 characters");
  });

  // -------------------------------------------------------------------------
  // incrementFreeToolUsage — basic increment + subject hash
  // -------------------------------------------------------------------------

  it("increments usage and allows requests at the limit boundary", async () => {
    // Start with count=2, limit=3 → nextCount=3 → allowed:true, remaining:0
    // We seed the DB at count=2 first via two increments
    await incrementFreeToolUsage(
      {
        toolId: "word-counter",
        limit: 3,
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        now: new Date("2026-04-25T12:00:00.000Z"),
      },
      "default",
      db,
    );
    await incrementFreeToolUsage(
      {
        toolId: "word-counter",
        limit: 3,
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        now: new Date("2026-04-25T12:00:00.000Z"),
      },
      "default",
      db,
    );

    const result = await incrementFreeToolUsage(
      {
        toolId: "word-counter",
        limit: 3,
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        now: new Date("2026-04-25T12:00:00.000Z"),
      },
      "default",
      db,
    );

    expect(result).toMatchObject({ allowed: true, count: 3, remaining: 0, day: "20260425" });
  });

  it("does not increment when the next request would exceed the limit", async () => {
    // Fill up all 3 slots
    for (let i = 0; i < 3; i++) {
      await incrementFreeToolUsage(
        {
          toolId: "word-counter",
          limit: 3,
          ip: "203.0.113.10",
          userAgent: "Vitest",
          secret: TEST_HASH_SECRET,
          now: new Date("2026-04-25T12:00:00.000Z"),
        },
        "default",
        db,
      );
    }

    // 4th request should be denied
    const result = await incrementFreeToolUsage(
      {
        toolId: "word-counter",
        limit: 3,
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        now: new Date("2026-04-25T12:00:00.000Z"),
      },
      "default",
      db,
    );

    expect(result).toMatchObject({ allowed: false, count: 3, remaining: 0 });
  });

  it("allows first use and returns correct count", async () => {
    const result = await incrementFreeToolUsage(
      {
        toolId: "word-counter",
        limit: 5,
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        now: new Date("2026-04-25T12:00:00.000Z"),
      },
      "default",
      db,
    );

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
    expect(result.remaining).toBe(4);
    expect(result.day).toBe("20260425");
  });

  it("stores subjectHash as hex without raw IP/userAgent", async () => {
    const { freeToolUsage } = await import("@/db/schema/free-tools");
    const { eq } = await import("drizzle-orm");

    await incrementFreeToolUsage(
      {
        toolId: "word-counter",
        limit: 5,
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        now: new Date("2026-04-25T12:00:00.000Z"),
      },
      "default",
      db,
    );

    const rows = await (db as unknown as ReturnType<typeof drizzle>)
      .select()
      .from(freeToolUsage)
      .where(eq(freeToolUsage.toolId, "word-counter"));

    expect(rows).toHaveLength(1);
    expect(rows[0].subjectHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].subjectHash).not.toContain("203.0.113.10");
    expect(rows[0].count).toBe(1);
    expect(rows[0].blogId).toBe("default");
  });

  it("preserves firstUsedAt across increments", async () => {
    const firstTime = new Date("2026-04-25T10:00:00.000Z");
    const secondTime = new Date("2026-04-25T11:00:00.000Z");

    await incrementFreeToolUsage(
      {
        toolId: "word-counter",
        limit: 5,
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        now: firstTime,
      },
      "default",
      db,
    );
    await incrementFreeToolUsage(
      {
        toolId: "word-counter",
        limit: 5,
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        now: secondTime,
      },
      "default",
      db,
    );

    const { freeToolUsage } = await import("@/db/schema/free-tools");
    const { eq } = await import("drizzle-orm");

    const rows = await (db as unknown as ReturnType<typeof drizzle>)
      .select()
      .from(freeToolUsage)
      .where(eq(freeToolUsage.toolId, "word-counter"));

    expect(rows[0].firstUsedAt).toBe(firstTime.getTime());
    expect(rows[0].lastUsedAt).toBe(secondTime.getTime());
    expect(rows[0].count).toBe(2);
  });

  it("different tools get separate usage records", async () => {
    await incrementFreeToolUsage(
      {
        toolId: "word-counter",
        limit: 5,
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        now: new Date("2026-04-25T12:00:00.000Z"),
      },
      "default",
      db,
    );
    await incrementFreeToolUsage(
      {
        toolId: "blog-outline-generator",
        limit: 5,
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        now: new Date("2026-04-25T12:00:00.000Z"),
      },
      "default",
      db,
    );

    const r1 = await incrementFreeToolUsage(
      {
        toolId: "word-counter",
        limit: 5,
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        now: new Date("2026-04-25T12:00:00.000Z"),
      },
      "default",
      db,
    );
    expect(r1.count).toBe(2); // Only word-counter incremented
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  it("usage records from blog-a are invisible to blog-b", async () => {
    // Fill limit in blog-a
    for (let i = 0; i < 3; i++) {
      await incrementFreeToolUsage(
        {
          toolId: "word-counter",
          limit: 3,
          ip: "203.0.113.10",
          userAgent: "Vitest",
          secret: TEST_HASH_SECRET,
          now: new Date("2026-04-25T12:00:00.000Z"),
        },
        "blog-a",
        db,
      );
    }

    // blog-b should not be rate-limited
    const result = await incrementFreeToolUsage(
      {
        toolId: "word-counter",
        limit: 3,
        ip: "203.0.113.10",
        userAgent: "Vitest",
        secret: TEST_HASH_SECRET,
        now: new Date("2026-04-25T12:00:00.000Z"),
      },
      "blog-b",
      db,
    );
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
  });
});
