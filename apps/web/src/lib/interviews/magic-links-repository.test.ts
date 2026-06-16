import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  createMagicLink,
  getMagicLinkByTokenHash,
  claimMagicLink,
} from "./magic-links-repository";

type TestDb = Parameters<typeof createMagicLink>[2];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE magic_links (
    id text PRIMARY KEY NOT NULL,
    blog_id text NOT NULL,
    share_link_id text NOT NULL,
    token_hash text NOT NULL,
    email text,
    expires_at text,
    consumed_at integer,
    created_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE UNIQUE INDEX magic_links_token_hash_idx ON magic_links (token_hash);`,
  );
  await client.execute(
    `CREATE INDEX magic_links_blog_sl_idx ON magic_links (blog_id, share_link_id);`,
  );
  const db = drizzle(client, { schema });
  return db as unknown as TestDb;
}

const blog_id = "blog-test";
const blog_id_2 = "blog-other";

describe("magic-links-repository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // create + read
  // ---------------------------------------------------------------------------

  it("creates a magic link and retrieves it by token hash", async () => {
    const link = await createMagicLink(
      blog_id,
      {
        shareLinkId: "sl-1",
        tokenHash: "hash-abc",
        email: "guest@example.com",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
      db,
    );

    expect(link.id).toBeDefined();
    expect(link.blogId).toBe(blog_id);
    expect(link.shareLinkId).toBe("sl-1");
    expect(link.tokenHash).toBe("hash-abc");
    expect(link.email).toBe("guest@example.com");
    expect(link.consumedAt).toBeNull();
    expect(link.createdAt).toBeGreaterThan(0);

    const fetched = await getMagicLinkByTokenHash("hash-abc", db);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(link.id);
    expect(fetched?.email).toBe("guest@example.com");
  });

  it("returns null for unknown token hash", async () => {
    const fetched = await getMagicLinkByTokenHash("no-such-hash", db);
    expect(fetched).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // claim — success
  // ---------------------------------------------------------------------------

  it("claim-once: first claim succeeds and sets consumedAt", async () => {
    const beforeCreate = Date.now();
    await createMagicLink(
      blog_id,
      {
        shareLinkId: "sl-1",
        tokenHash: "hash-claim",
        email: "guest@example.com",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      db,
    );

    const result = await claimMagicLink(blog_id, "hash-claim", db);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok");
    expect(result.email).toBe("guest@example.com");
    expect(result.row.consumedAt).toBeGreaterThanOrEqual(beforeCreate);

    // After claiming, the row's consumedAt is set in DB
    const fetched = await getMagicLinkByTokenHash("hash-claim", db);
    expect(fetched?.consumedAt).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // claim — already consumed
  // ---------------------------------------------------------------------------

  it("second claim returns already-consumed", async () => {
    await createMagicLink(
      blog_id,
      {
        shareLinkId: "sl-1",
        tokenHash: "hash-double",
        email: "guest@example.com",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      db,
    );

    const first = await claimMagicLink(blog_id, "hash-double", db);
    expect(first.ok).toBe(true);

    const second = await claimMagicLink(blog_id, "hash-double", db);
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("Expected failure");
    expect(second.reason).toBe("consumed");
  });

  // ---------------------------------------------------------------------------
  // concurrent double-claim: only one succeeds
  // ---------------------------------------------------------------------------

  it("concurrent double-redeem: exactly one claim succeeds", async () => {
    await createMagicLink(
      blog_id,
      {
        shareLinkId: "sl-1",
        tokenHash: "hash-concurrent",
        email: "guest@example.com",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      db,
    );

    // Fire two concurrent claims against the same token. The D1 conditional
    // UPDATE … WHERE consumed_at IS NULL ensures exactly one UPDATE succeeds.
    // In-memory libsql serializes writes, so one wins and one sees 0 rows.
    const [result1, result2] = await Promise.all([
      claimMagicLink(blog_id, "hash-concurrent", db),
      claimMagicLink(blog_id, "hash-concurrent", db),
    ]);

    const successes = [result1, result2].filter((r) => r.ok);
    const failures = [result1, result2].filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    if (!failures[0].ok) {
      expect(failures[0].reason).toBe("consumed");
    }
  });

  // ---------------------------------------------------------------------------
  // claim — expired
  // ---------------------------------------------------------------------------

  it("claim returns expired when expiresAt is in the past", async () => {
    await createMagicLink(
      blog_id,
      {
        shareLinkId: "sl-1",
        tokenHash: "hash-expired",
        email: "guest@example.com",
        expiresAt: new Date(Date.now() - 1000).toISOString(), // already expired
      },
      db,
    );

    const result = await claimMagicLink(blog_id, "hash-expired", db);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.reason).toBe("expired");
  });

  // ---------------------------------------------------------------------------
  // claim — not found
  // ---------------------------------------------------------------------------

  it("claim returns not_found for unknown hash", async () => {
    const result = await claimMagicLink(blog_id, "no-such-hash", db);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.reason).toBe("not_found");
  });

  // ---------------------------------------------------------------------------
  // tenant isolation
  // ---------------------------------------------------------------------------

  it("claim returns not_found when blogId does not match", async () => {
    // Create under blog_id but try to claim under blog_id_2
    await createMagicLink(
      blog_id,
      {
        shareLinkId: "sl-1",
        tokenHash: "hash-tenant",
        email: "guest@example.com",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
      db,
    );

    const result = await claimMagicLink(blog_id_2, "hash-tenant", db);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.reason).toBe("not_found");

    // The original row must still be unclaimed
    const fetched = await getMagicLinkByTokenHash("hash-tenant", db);
    expect(fetched?.consumedAt).toBeNull();
  });
});
