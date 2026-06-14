import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

import {
  createIntegration,
  createIntegrationWithId,
  deleteIntegration,
  deleteIntegrations,
  getIntegration,
  listIntegrations,
  listIntegrationsByTypeAndStatus,
  updateIntegration,
} from "./repository";

type TestDb = Parameters<typeof listIntegrations>[1];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE integrations (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'disconnected' NOT NULL,
    description text DEFAULT '' NOT NULL,
    icon text DEFAULT '' NOT NULL,
    config text DEFAULT '{}' NOT NULL,
    connected_at integer,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );`);
  await client.execute(`CREATE INDEX integrations_blog_idx ON integrations (blog_id);`);
  await client.execute(`CREATE INDEX integrations_blog_type_idx ON integrations (blog_id, type);`);
  return drizzle(client, { schema }) as unknown as TestDb;
}

const BLOG_A = "blog-a";
const BLOG_B = "blog-b";

describe("integrations repository", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // listIntegrations
  // ---------------------------------------------------------------------------

  it("lists empty initially", async () => {
    expect(await listIntegrations(BLOG_A, db)).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // createIntegration + shape
  // ---------------------------------------------------------------------------

  it("creates an integration and returns correct shape", async () => {
    const row = await createIntegration(
      BLOG_A,
      {
        name: "My Webhook",
        type: "webhook",
        status: "connected",
        description: "test",
        icon: "W",
        config: { mode: "article_receiver", token: "abc" },
        connectedAt: 1000,
      },
      db,
    );

    expect(typeof row.id).toBe("string");
    expect(row.id.length).toBeGreaterThan(0);
    expect(row.blogId).toBe(BLOG_A);
    expect(row.name).toBe("My Webhook");
    expect(row.type).toBe("webhook");
    expect(row.status).toBe("connected");
    expect(row.config).toEqual({ mode: "article_receiver", token: "abc" });
    expect(row.connectedAt).toBe(1000);
    expect(typeof row.createdAt).toBe("number");
  });

  it("createIntegrationWithId uses the supplied id", async () => {
    const row = await createIntegrationWithId(
      BLOG_A,
      "my-fixed-id",
      {
        name: "Webhook",
        type: "webhook",
        status: "connected",
        description: "",
        icon: "W",
        config: {},
        connectedAt: null,
      },
      db,
    );

    expect(row.id).toBe("my-fixed-id");
  });

  // ---------------------------------------------------------------------------
  // getIntegration
  // ---------------------------------------------------------------------------

  it("returns null for missing id", async () => {
    expect(await getIntegration(BLOG_A, "nonexistent", db)).toBeNull();
  });

  it("create→get round-trips the config JSON", async () => {
    const config = { provider: "google_analytics", oauthClientId: "c-id" };
    const created = await createIntegration(
      BLOG_A,
      {
        name: "GA4",
        type: "oauth",
        status: "disconnected",
        description: "",
        icon: "G",
        config,
        connectedAt: null,
      },
      db,
    );

    const fetched = await getIntegration(BLOG_A, created.id, db);
    expect(fetched).not.toBeNull();
    expect(fetched!.config).toEqual(config);
  });

  // ---------------------------------------------------------------------------
  // listIntegrations ordering
  // ---------------------------------------------------------------------------

  it("lists newest first with id tiebreaker", async () => {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(1000) // first insert createdAt
      .mockReturnValueOnce(1000) // first insert updatedAt
      .mockReturnValueOnce(2000) // second insert createdAt
      .mockReturnValueOnce(2000); // second insert updatedAt

    try {
      await createIntegration(BLOG_A, { name: "First", type: "webhook", status: "connected", description: "", icon: "F", config: {}, connectedAt: null }, db);
      await createIntegration(BLOG_A, { name: "Second", type: "webhook", status: "connected", description: "", icon: "S", config: {}, connectedAt: null }, db);
    } finally {
      nowSpy.mockRestore();
    }

    const rows = await listIntegrations(BLOG_A, db);
    expect(rows[0].name).toBe("Second");
    expect(rows[1].name).toBe("First");
  });

  // ---------------------------------------------------------------------------
  // updateIntegration
  // ---------------------------------------------------------------------------

  it("updates scalar fields", async () => {
    const created = await createIntegration(BLOG_A, { name: "Old", type: "webhook", status: "connected", description: "", icon: "O", config: {}, connectedAt: null }, db);

    const updated = await updateIntegration(BLOG_A, created.id, { name: "New", status: "disconnected" }, db);

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("New");
    expect(updated!.status).toBe("disconnected");
  });

  it("replaces config on update", async () => {
    const created = await createIntegration(BLOG_A, { name: "T", type: "webhook", status: "connected", description: "", icon: "T", config: { token: "old" }, connectedAt: null }, db);

    const updated = await updateIntegration(BLOG_A, created.id, { config: { token: "new", extra: "yes" } }, db);

    expect(updated!.config).toEqual({ token: "new", extra: "yes" });
  });

  it("sets connectedAt on update", async () => {
    const created = await createIntegration(BLOG_A, { name: "T", type: "oauth", status: "disconnected", description: "", icon: "T", config: {}, connectedAt: null }, db);

    const updated = await updateIntegration(BLOG_A, created.id, { connectedAt: 9999 }, db);

    expect(updated!.connectedAt).toBe(9999);
  });

  it("returns null when updating non-existent id", async () => {
    const result = await updateIntegration(BLOG_A, "ghost", { name: "X" }, db);
    expect(result).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // deleteIntegration (single)
  // ---------------------------------------------------------------------------

  it("deletes a single integration and returns true", async () => {
    const created = await createIntegration(BLOG_A, { name: "Del", type: "webhook", status: "connected", description: "", icon: "D", config: {}, connectedAt: null }, db);

    expect(await deleteIntegration(BLOG_A, created.id, db)).toBe(true);
    expect(await getIntegration(BLOG_A, created.id, db)).toBeNull();
  });

  it("returns false when deleting a non-existent integration", async () => {
    expect(await deleteIntegration(BLOG_A, "nonexistent", db)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // deleteIntegrations (bulk)
  // ---------------------------------------------------------------------------

  it("bulk deletes and returns count", async () => {
    const k1 = await createIntegration(BLOG_A, { name: "K1", type: "webhook", status: "connected", description: "", icon: "K", config: {}, connectedAt: null }, db);
    const k2 = await createIntegration(BLOG_A, { name: "K2", type: "webhook", status: "connected", description: "", icon: "K", config: {}, connectedAt: null }, db);

    const deleted = await deleteIntegrations(BLOG_A, [k1.id, k2.id], db);
    expect(deleted).toBe(2);
    expect(await listIntegrations(BLOG_A, db)).toEqual([]);
  });

  it("bulk delete returns 0 for empty ids", async () => {
    expect(await deleteIntegrations(BLOG_A, [], db)).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // listIntegrationsByTypeAndStatus
  // ---------------------------------------------------------------------------

  it("filters by type and status", async () => {
    await createIntegration(BLOG_A, { name: "Connected OAuth", type: "oauth", status: "connected", description: "", icon: "O", config: {}, connectedAt: 1000 }, db);
    await createIntegration(BLOG_A, { name: "Disconnected OAuth", type: "oauth", status: "disconnected", description: "", icon: "O", config: {}, connectedAt: null }, db);
    await createIntegration(BLOG_A, { name: "Webhook", type: "webhook", status: "connected", description: "", icon: "W", config: {}, connectedAt: null }, db);

    const rows = await listIntegrationsByTypeAndStatus(BLOG_A, "oauth", "connected", db);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Connected OAuth");
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation — CRITICAL
  // ---------------------------------------------------------------------------

  it("listIntegrations does not leak across blogs", async () => {
    await createIntegration(BLOG_A, { name: "A", type: "webhook", status: "connected", description: "", icon: "A", config: {}, connectedAt: null }, db);

    expect(await listIntegrations(BLOG_B, db)).toEqual([]);
  });

  it("getIntegration does not return another blog's integration", async () => {
    const row = await createIntegration(BLOG_A, { name: "A", type: "webhook", status: "connected", description: "", icon: "A", config: {}, connectedAt: null }, db);

    expect(await getIntegration(BLOG_B, row.id, db)).toBeNull();
  });

  it("updateIntegration does not modify another blog's integration", async () => {
    const row = await createIntegration(BLOG_A, { name: "A", type: "webhook", status: "connected", description: "", icon: "A", config: {}, connectedAt: null }, db);

    const result = await updateIntegration(BLOG_B, row.id, { name: "Hacked" }, db);
    expect(result).toBeNull();

    const unchanged = await getIntegration(BLOG_A, row.id, db);
    expect(unchanged!.name).toBe("A");
  });

  it("deleteIntegration does not remove another blog's integration", async () => {
    const row = await createIntegration(BLOG_A, { name: "A", type: "webhook", status: "connected", description: "", icon: "A", config: {}, connectedAt: null }, db);

    const deleted = await deleteIntegration(BLOG_B, row.id, db);
    expect(deleted).toBe(false);

    expect(await getIntegration(BLOG_A, row.id, db)).not.toBeNull();
  });

  it("deleteIntegrations (bulk) does not remove another blog's integrations", async () => {
    const row = await createIntegration(BLOG_A, { name: "A", type: "webhook", status: "connected", description: "", icon: "A", config: {}, connectedAt: null }, db);

    const count = await deleteIntegrations(BLOG_B, [row.id], db);
    expect(count).toBe(0);
    expect(await getIntegration(BLOG_A, row.id, db)).not.toBeNull();
  });
});
