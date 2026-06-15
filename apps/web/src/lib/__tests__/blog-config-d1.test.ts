/**
 * Unit tests for the knowledge base-config D1 repository functions.
 *
 * Uses real in-memory SQLite (libsql) so drizzle queries actually run,
 * matching the pattern used by categories/repository.test.ts.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { DEFAULT_BLOG_CONFIG, getStoredBlogConfig, updateBlogConfig } from "@/lib/blog-config";

// The repository functions accept an optional `db` parameter.
type TestDb = Parameters<typeof getStoredBlogConfig>[1];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`
    CREATE TABLE blog_config (
      blog_id text PRIMARY KEY NOT NULL,
      data    text    NOT NULL,
      updated_at integer NOT NULL
    );
  `);
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("blog-config D1 repository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  it("returns DEFAULT_BLOG_CONFIG when no row exists", async () => {
    // getStoredBlogConfig returns {}
    const stored = await getStoredBlogConfig("default", db);
    expect(stored).toEqual({});
  });

  it("stores and retrieves overrides (round-trip)", async () => {
    const overrides = {
      siteName: "My Support Hub",
      seo: { defaultMetaTitle: "Custom Title", defaultMetaDescription: "Desc", googleAnalyticsId: "", clarityId: "", submissionProtocols: { indexNow: { enabled: false, apiKey: "" } } },
    };

    await updateBlogConfig("default", overrides, db);

    const retrieved = await getStoredBlogConfig("default", db);
    expect(retrieved).toEqual(overrides);
  });

  it("upserts correctly (second write replaces first)", async () => {
    await updateBlogConfig("default", { siteName: "First" }, db);
    await updateBlogConfig("default", { siteName: "Second" }, db);

    const retrieved = await getStoredBlogConfig("default", db);
    expect((retrieved as { siteName?: string }).siteName).toBe("Second");
  });

  it("isolates stored configs by blogId (tenant isolation)", async () => {
    const overridesA = { siteName: "Blog A" };
    const overridesB = { siteName: "Blog B" };

    await updateBlogConfig("blog-a", overridesA, db);
    await updateBlogConfig("blog-b", overridesB, db);

    const a = await getStoredBlogConfig("blog-a", db);
    const b = await getStoredBlogConfig("blog-b", db);

    expect((a as { siteName?: string }).siteName).toBe("Blog A");
    expect((b as { siteName?: string }).siteName).toBe("Blog B");

    // default blog is still empty
    const def = await getStoredBlogConfig("default", db);
    expect(def).toEqual({});
  });

  it("getStoredBlogConfig returns {} for an unknown blogId", async () => {
    await updateBlogConfig("blog-a", { siteName: "A" }, db);
    const other = await getStoredBlogConfig("blog-b", db);
    expect(other).toEqual({});
  });

  it("DEFAULT_BLOG_CONFIG has expected baseline values", () => {
    expect(DEFAULT_BLOG_CONFIG.blogId).toBe("default");
    expect(DEFAULT_BLOG_CONFIG.siteName).toBe("Support Portal");
    expect(DEFAULT_BLOG_CONFIG.seo.submissionProtocols?.indexNow).toEqual({
      enabled: false,
      apiKey: "",
    });
  });
});
