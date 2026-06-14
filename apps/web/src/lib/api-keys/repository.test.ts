import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

import {
  createApiKey,
  deleteApiKeys,
  findApiKeyByToken,
  listApiKeys,
  touchApiKeyLastUsed,
} from "./repository";

// Real in-memory SQLite (libsql) so drizzle queries actually run.
type TestDb = Parameters<typeof listApiKeys>[1];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE api_keys (
    id text PRIMARY KEY NOT NULL,
    owner_id text NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    name text NOT NULL,
    key_preview text NOT NULL,
    key_hash text NOT NULL,
    scopes text NOT NULL,
    last_used integer,
    created_at integer NOT NULL
  );`);
  await client.execute(`CREATE INDEX api_keys_owner_idx ON api_keys (owner_id);`);
  await client.execute(`CREATE UNIQUE INDEX api_keys_key_hash_idx ON api_keys (key_hash);`);
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("api-keys repository", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // listApiKeys
  // ---------------------------------------------------------------------------

  it("lists empty initially", async () => {
    expect(await listApiKeys("user-1", db)).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // createApiKey + shape
  // ---------------------------------------------------------------------------

  it("creates a key and returns correct shape", async () => {
    const result = await createApiKey(
      "user-1",
      "blog-1",
      { name: "My Key", scopes: ["read", "write"] },
      db,
    );

    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.name).toBe("My Key");
    expect(result.scopes).toEqual(["read", "write"]);
    expect(result.key).toMatch(/^sk-[0-9a-f]{64}$/);
    expect(result.keyPreview).toMatch(/^sk-\.\.\.[0-9a-f]{4}$/);
  });

  it("create→list shows the entry with numeric createdAt and null lastUsed", async () => {
    const before = Date.now();
    await createApiKey("user-1", "blog-1", { name: "K", scopes: ["read"] }, db);
    const after = Date.now();

    const list = await listApiKeys("user-1", db);
    expect(list).toHaveLength(1);

    const entry = list[0];
    expect(entry.name).toBe("K");
    expect(entry.scopes).toEqual(["read"]);
    expect(typeof entry.createdAt).toBe("number");
    expect(entry.createdAt).toBeGreaterThanOrEqual(before);
    expect(entry.createdAt).toBeLessThanOrEqual(after);
    expect(entry.lastUsed).toBeNull();
    expect(entry.keyPreview).toMatch(/^sk-\.\.\.[0-9a-f]{4}$/);
  });

  it("list is ordered newest first", async () => {
    // Pin distinct createdAt values so ordering is deterministic (createdAt is
    // ms-resolution; same-ms creates would otherwise tie).
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(2000);
    await createApiKey("user-1", "blog-1", { name: "First", scopes: ["read"] }, db);
    await createApiKey("user-1", "blog-1", { name: "Second", scopes: ["read"] }, db);
    nowSpy.mockRestore();

    const list = await listApiKeys("user-1", db);
    // newest (Second, createdAt 2000) comes first
    expect(list[0].name).toBe("Second");
    expect(list[1].name).toBe("First");
  });

  // ---------------------------------------------------------------------------
  // Owner isolation
  // ---------------------------------------------------------------------------

  it("user A cannot list user B's keys", async () => {
    await createApiKey("user-a", "blog-1", { name: "A Key", scopes: ["read"] }, db);

    expect(await listApiKeys("user-b", db)).toEqual([]);
  });

  it("user A cannot delete user B's keys", async () => {
    const created = await createApiKey(
      "user-b",
      "blog-1",
      { name: "B Key", scopes: ["read"] },
      db,
    );

    const deleted = await deleteApiKeys("user-a", [created.id], db);
    expect(deleted).toBe(0);

    // Key still exists for user-b
    const list = await listApiKeys("user-b", db);
    expect(list).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // deleteApiKeys
  // ---------------------------------------------------------------------------

  it("deletes own keys and returns count", async () => {
    const k1 = await createApiKey("user-1", "blog-1", { name: "K1", scopes: ["read"] }, db);
    const k2 = await createApiKey("user-1", "blog-1", { name: "K2", scopes: ["read"] }, db);

    const deleted = await deleteApiKeys("user-1", [k1.id, k2.id], db);
    expect(deleted).toBe(2);
    expect(await listApiKeys("user-1", db)).toEqual([]);
  });

  it("deletes only the specified ids", async () => {
    const k1 = await createApiKey("user-1", "blog-1", { name: "K1", scopes: ["read"] }, db);
    await createApiKey("user-1", "blog-1", { name: "K2", scopes: ["read"] }, db);

    const deleted = await deleteApiKeys("user-1", [k1.id], db);
    expect(deleted).toBe(1);

    const remaining = await listApiKeys("user-1", db);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe("K2");
  });

  it("returns 0 when deleting nonexistent ids", async () => {
    const deleted = await deleteApiKeys("user-1", ["nonexistent-id"], db);
    expect(deleted).toBe(0);
  });

  it("delete only affects own keys even when mixing owner ids in batch", async () => {
    const kA = await createApiKey("user-a", "blog-1", { name: "A Key", scopes: ["read"] }, db);
    const kB = await createApiKey("user-b", "blog-1", { name: "B Key", scopes: ["read"] }, db);

    // user-a tries to delete both
    const deleted = await deleteApiKeys("user-a", [kA.id, kB.id], db);
    expect(deleted).toBe(1); // only own key

    // user-b key still exists
    expect(await listApiKeys("user-b", db)).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // findApiKeyByToken
  // ---------------------------------------------------------------------------

  it("returns key data for a valid token", async () => {
    const created = await createApiKey(
      "user-1",
      "blog-1",
      { name: "Token Key", scopes: ["read", "admin"] },
      db,
    );

    const found = await findApiKeyByToken(created.key, db);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.ownerId).toBe("user-1");
    expect(found?.blogId).toBe("blog-1");
    expect(found?.scopes).toEqual(["read", "admin"]);
  });

  it("returns the blog the key is bound to (tenant scope), distinct per key", async () => {
    const keyB = await createApiKey(
      "user-1",
      "blog-B",
      { name: "B Key", scopes: ["write"] },
      db,
    );
    const keyC = await createApiKey(
      "user-2",
      "blog-C",
      { name: "C Key", scopes: ["read"] },
      db,
    );

    const foundB = await findApiKeyByToken(keyB.key, db);
    const foundC = await findApiKeyByToken(keyC.key, db);

    expect(foundB?.blogId).toBe("blog-B");
    expect(foundC?.blogId).toBe("blog-C");
  });

  it("returns null for an unknown token", async () => {
    expect(await findApiKeyByToken("sk-unknown", db)).toBeNull();
  });

  it("returns null when no keys exist", async () => {
    expect(await findApiKeyByToken("sk-anything", db)).toBeNull();
  });

  it("finds the correct key among multiple keys", async () => {
    const k1 = await createApiKey("user-1", "blog-1", { name: "K1", scopes: ["read"] }, db);
    const k2 = await createApiKey("user-2", "blog-1", { name: "K2", scopes: ["write"] }, db);

    const found1 = await findApiKeyByToken(k1.key, db);
    expect(found1?.ownerId).toBe("user-1");
    expect(found1?.scopes).toEqual(["read"]);

    const found2 = await findApiKeyByToken(k2.key, db);
    expect(found2?.ownerId).toBe("user-2");
    expect(found2?.scopes).toEqual(["write"]);
  });

  // ---------------------------------------------------------------------------
  // touchApiKeyLastUsed
  // ---------------------------------------------------------------------------

  it("sets lastUsed on an existing key and returns 1", async () => {
    const created = await createApiKey(
      "user-1",
      "blog-1",
      { name: "K", scopes: ["read"] },
      db,
    );
    // Freshly created → lastUsed is null.
    expect((await listApiKeys("user-1", db))[0].lastUsed).toBeNull();

    const before = Date.now();
    const updated = await touchApiKeyLastUsed(created.id, db);
    const after = Date.now();
    expect(updated).toBe(1);

    const entry = (await listApiKeys("user-1", db))[0];
    expect(typeof entry.lastUsed).toBe("number");
    expect(entry.lastUsed).toBeGreaterThanOrEqual(before);
    expect(entry.lastUsed).toBeLessThanOrEqual(after);
  });

  it("returns 0 when touching a nonexistent id and leaves other keys untouched", async () => {
    await createApiKey("user-1", "blog-1", { name: "K", scopes: ["read"] }, db);

    const updated = await touchApiKeyLastUsed("nonexistent-id", db);
    expect(updated).toBe(0);

    // The real key still has a null lastUsed.
    expect((await listApiKeys("user-1", db))[0].lastUsed).toBeNull();
  });

  it("only touches the targeted key, not others belonging to the same owner", async () => {
    const k1 = await createApiKey("user-1", "blog-1", { name: "K1", scopes: ["read"] }, db);
    await createApiKey("user-1", "blog-1", { name: "K2", scopes: ["read"] }, db);

    await touchApiKeyLastUsed(k1.id, db);

    const list = await listApiKeys("user-1", db);
    const touched = list.find((e) => e.id === k1.id);
    const untouched = list.find((e) => e.id !== k1.id);
    expect(typeof touched?.lastUsed).toBe("number");
    expect(untouched?.lastUsed).toBeNull();
  });
});
