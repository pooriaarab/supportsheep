import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

import {
  createShareLink,
  getShareLink,
  getShareLinkByTokenHash,
  updateShareLink,
  deleteShareLink,
  listShareLinks,
  incrementShareLinkUses,
  atomicIncrementUsesIfAvailable,
  validateShareLinkForUse,
  isShareLinkScheduledFuture,
} from "./share-links-repository";

type TestDb = Parameters<typeof listShareLinks>[2];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE share_links (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    type text NOT NULL,
    created_by text NOT NULL,
    workspace_id text DEFAULT 'default' NOT NULL,
    topic text,
    goal text,
    style text DEFAULT 'smart' NOT NULL,
    auth_mode text DEFAULT 'anonymous' NOT NULL,
    recording_config text DEFAULT 'transcript' NOT NULL,
    max_duration_sec integer DEFAULT 300 NOT NULL,
    expires_at text,
    max_uses integer,
    uses integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'active' NOT NULL,
    token_hash text NOT NULL,
    language text DEFAULT 'en' NOT NULL,
    scheduled_at text,
    scheduled_guest_email text,
    mode text DEFAULT 'live' NOT NULL,
    async_questions text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );`);
  await client.execute(`CREATE INDEX share_links_blog_idx ON share_links (blog_id);`);
  await client.execute(`CREATE UNIQUE INDEX share_links_token_hash_idx ON share_links (token_hash);`);
  await client.execute(`CREATE INDEX share_links_blog_created_by_idx ON share_links (blog_id, created_by);`);
  await client.execute(`CREATE INDEX share_links_blog_status_idx ON share_links (blog_id, status);`);
  return drizzle(client, { schema }) as unknown as TestDb;
}

const BLOG_A = "blog-a";
const BLOG_B = "blog-b";

function makeInput(overrides: Record<string, unknown> = {}) {
  return {
    type: "link" as const,
    createdBy: "user-1",
    tokenHash: `hash-${Math.random()}`,
    style: "smart" as const,
    authMode: "anonymous" as const,
    recordingConfig: "transcript" as const,
    maxDurationSec: 300,
    language: "en" as const,
    ...overrides,
  };
}

describe("share-links repository", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // createShareLink + shape
  // ---------------------------------------------------------------------------

  it("creates a share link and returns correct shape", async () => {
    const row = await createShareLink(BLOG_A, makeInput({ tokenHash: "abc123" }), db);

    expect(typeof row.id).toBe("string");
    expect(row.id.length).toBeGreaterThan(0);
    expect(row.blogId).toBe(BLOG_A);
    expect(row.type).toBe("link");
    expect(row.createdBy).toBe("user-1");
    expect(row.tokenHash).toBe("abc123");
    expect(row.uses).toBe(0);
    expect(row.status).toBe("active");
    expect(typeof row.createdAt).toBe("number");
  });

  it("stores and retrieves asyncQuestions as JSON", async () => {
    const questions = [
      { id: "q1", text: "Tell me about yourself", audioStoragePath: "path/to/audio.mp3" },
    ];
    const row = await createShareLink(
      BLOG_A,
      makeInput({ asyncQuestions: questions }),
      db,
    );
    expect(row.asyncQuestions).toEqual(questions);

    const fetched = await getShareLink(BLOG_A, row.id, db);
    expect(fetched!.asyncQuestions).toEqual(questions);
  });

  // ---------------------------------------------------------------------------
  // getShareLink
  // ---------------------------------------------------------------------------

  it("returns null for missing id", async () => {
    expect(await getShareLink(BLOG_A, "nonexistent", db)).toBeNull();
  });

  it("create→get round-trips data", async () => {
    const created = await createShareLink(
      BLOG_A,
      makeInput({
        tokenHash: "round-trip-hash",
        topic: "My Topic",
        goal: "My Goal",
        language: "fr" as const,
        mode: "async" as const,
      }),
      db,
    );

    const fetched = await getShareLink(BLOG_A, created.id, db);
    expect(fetched).not.toBeNull();
    expect(fetched!.topic).toBe("My Topic");
    expect(fetched!.goal).toBe("My Goal");
    expect(fetched!.language).toBe("fr");
    expect(fetched!.mode).toBe("async");
  });

  // ---------------------------------------------------------------------------
  // getShareLinkByTokenHash (global)
  // ---------------------------------------------------------------------------

  it("finds by token hash across blogs", async () => {
    await createShareLink(BLOG_A, makeInput({ tokenHash: "global-hash-1" }), db);
    const found = await getShareLinkByTokenHash("global-hash-1", db);
    expect(found).not.toBeNull();
    expect(found!.tokenHash).toBe("global-hash-1");
  });

  it("returns null when token hash not found", async () => {
    expect(await getShareLinkByTokenHash("missing-hash", db)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // updateShareLink
  // ---------------------------------------------------------------------------

  it("updates status to revoked", async () => {
    const created = await createShareLink(BLOG_A, makeInput(), db);
    const updated = await updateShareLink(BLOG_A, created.id, { status: "revoked" }, db);
    expect(updated!.status).toBe("revoked");
  });

  it("returns null when updating non-existent id", async () => {
    const result = await updateShareLink(BLOG_A, "ghost", { status: "revoked" }, db);
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // incrementShareLinkUses (atomic)
  // ---------------------------------------------------------------------------

  it("increments uses atomically", async () => {
    const row = await createShareLink(BLOG_A, makeInput(), db);
    expect(row.uses).toBe(0);

    await incrementShareLinkUses(BLOG_A, row.id, db);
    await incrementShareLinkUses(BLOG_A, row.id, db);

    const updated = await getShareLink(BLOG_A, row.id, db);
    expect(updated!.uses).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // atomicIncrementUsesIfAvailable — race guard
  // ---------------------------------------------------------------------------

  it("increments when uses < maxUses (compare-and-swap)", async () => {
    const row = await createShareLink(BLOG_A, makeInput({ maxUses: 3 }), db);
    const ok = await atomicIncrementUsesIfAvailable(BLOG_A, row.id, 0, 3, db);
    expect(ok).toBe(true);

    const updated = await getShareLink(BLOG_A, row.id, db);
    expect(updated!.uses).toBe(1);
  });

  it("rejects increment when currentUses stale (race guard)", async () => {
    const row = await createShareLink(BLOG_A, makeInput({ maxUses: 1 }), db);

    // Simulate: first request already incremented (uses=1 = maxUses=1)
    await incrementShareLinkUses(BLOG_A, row.id, db);

    // Second request checks currentUses=0 (stale) but actual is 1 → rejected
    const ok = await atomicIncrementUsesIfAvailable(BLOG_A, row.id, 0, 1, db);
    expect(ok).toBe(false);

    const check = await getShareLink(BLOG_A, row.id, db);
    expect(check!.uses).toBe(1);
  });

  it("increments without limit when maxUses is null", async () => {
    const row = await createShareLink(BLOG_A, makeInput({ maxUses: null }), db);
    const ok = await atomicIncrementUsesIfAvailable(BLOG_A, row.id, 0, null, db);
    expect(ok).toBe(true);

    const updated = await getShareLink(BLOG_A, row.id, db);
    expect(updated!.uses).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // listShareLinks
  // ---------------------------------------------------------------------------

  it("lists newest first", async () => {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(2000);

    try {
      await createShareLink(BLOG_A, makeInput({ topic: "First" }), db);
      await createShareLink(BLOG_A, makeInput({ topic: "Second" }), db);
    } finally {
      nowSpy.mockRestore();
    }

    const rows = await listShareLinks(BLOG_A, {}, db);
    expect(rows[0].topic).toBe("Second");
    expect(rows[1].topic).toBe("First");
  });

  it("filters by status", async () => {
    await createShareLink(BLOG_A, makeInput({ tokenHash: "active-hash" }), db);
    await updateShareLink(
      BLOG_A,
      (await createShareLink(BLOG_A, makeInput({ tokenHash: "revoked-hash" }), db)).id,
      { status: "revoked" },
      db,
    );

    const active = await listShareLinks(BLOG_A, { status: "active" }, db);
    expect(active).toHaveLength(1);
    expect(active[0].status).toBe("active");
  });

  it("filters by createdBy", async () => {
    await createShareLink(BLOG_A, makeInput({ createdBy: "user-a", tokenHash: "h1" }), db);
    await createShareLink(BLOG_A, makeInput({ createdBy: "user-b", tokenHash: "h2" }), db);

    const rows = await listShareLinks(BLOG_A, { createdBy: "user-a" }, db);
    expect(rows).toHaveLength(1);
    expect(rows[0].createdBy).toBe("user-a");
  });

  // ---------------------------------------------------------------------------
  // deleteShareLink
  // ---------------------------------------------------------------------------

  it("deletes and returns true", async () => {
    const row = await createShareLink(BLOG_A, makeInput(), db);
    expect(await deleteShareLink(BLOG_A, row.id, db)).toBe(true);
    expect(await getShareLink(BLOG_A, row.id, db)).toBeNull();
  });

  it("returns false for non-existent id", async () => {
    expect(await deleteShareLink(BLOG_A, "ghost", db)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // validateShareLinkForUse
  // ---------------------------------------------------------------------------

  it("validates active link with no constraints", () => {
    const row = {
      status: "active",
      expiresAt: null,
      maxUses: null,
      uses: 0,
    } as Parameters<typeof validateShareLinkForUse>[0];
    expect(validateShareLinkForUse(row)).toBeNull();
  });

  it("rejects revoked link", () => {
    const row = { status: "revoked", expiresAt: null, maxUses: null, uses: 0 } as Parameters<typeof validateShareLinkForUse>[0];
    expect(validateShareLinkForUse(row)).toBe("Share-link not active");
  });

  it("rejects expired link", () => {
    const row = {
      status: "active",
      expiresAt: new Date(Date.now() - 10000).toISOString(),
      maxUses: null,
      uses: 0,
    } as Parameters<typeof validateShareLinkForUse>[0];
    expect(validateShareLinkForUse(row)).toBe("Share-link expired");
  });

  it("rejects exhausted link", () => {
    const row = {
      status: "active",
      expiresAt: null,
      maxUses: 5,
      uses: 5,
    } as Parameters<typeof validateShareLinkForUse>[0];
    expect(validateShareLinkForUse(row)).toBe("Share-link uses exhausted");
  });

  it("accepts link not yet at maxUses limit", () => {
    const row = {
      status: "active",
      expiresAt: null,
      maxUses: 5,
      uses: 4,
    } as Parameters<typeof validateShareLinkForUse>[0];
    expect(validateShareLinkForUse(row)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // isShareLinkScheduledFuture
  // ---------------------------------------------------------------------------

  it("detects future scheduled time", () => {
    const row = {
      scheduledAt: new Date(Date.now() + 60000).toISOString(),
    } as Parameters<typeof isShareLinkScheduledFuture>[0];
    expect(isShareLinkScheduledFuture(row)).toBe(true);
  });

  it("allows past scheduled time", () => {
    const row = {
      scheduledAt: new Date(Date.now() - 60000).toISOString(),
    } as Parameters<typeof isShareLinkScheduledFuture>[0];
    expect(isShareLinkScheduledFuture(row)).toBe(false);
  });

  it("allows null scheduledAt", () => {
    const row = { scheduledAt: null } as Parameters<typeof isShareLinkScheduledFuture>[0];
    expect(isShareLinkScheduledFuture(row)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation — CRITICAL
  // ---------------------------------------------------------------------------

  it("listShareLinks does not leak across blogs", async () => {
    await createShareLink(BLOG_A, makeInput(), db);
    expect(await listShareLinks(BLOG_B, {}, db)).toEqual([]);
  });

  it("getShareLink does not return another blog's share link", async () => {
    const row = await createShareLink(BLOG_A, makeInput(), db);
    expect(await getShareLink(BLOG_B, row.id, db)).toBeNull();
  });

  it("updateShareLink does not modify another blog's share link", async () => {
    const row = await createShareLink(BLOG_A, makeInput(), db);
    const result = await updateShareLink(BLOG_B, row.id, { status: "revoked" }, db);
    expect(result).toBeNull();

    const unchanged = await getShareLink(BLOG_A, row.id, db);
    expect(unchanged!.status).toBe("active");
  });

  it("deleteShareLink does not remove another blog's share link", async () => {
    const row = await createShareLink(BLOG_A, makeInput(), db);
    expect(await deleteShareLink(BLOG_B, row.id, db)).toBe(false);
    expect(await getShareLink(BLOG_A, row.id, db)).not.toBeNull();
  });

  it("incrementShareLinkUses does not affect another blog's link", async () => {
    const row = await createShareLink(BLOG_A, makeInput(), db);
    await incrementShareLinkUses(BLOG_B, row.id, db);

    const unchanged = await getShareLink(BLOG_A, row.id, db);
    expect(unchanged!.uses).toBe(0);
  });
});
