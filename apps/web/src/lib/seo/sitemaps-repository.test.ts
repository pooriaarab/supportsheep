import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  createSitemap,
  deleteSitemap,
  getSitemap,
  listSitemaps,
  listSitemapsForBlog,
  updateSitemap,
} from "./sitemaps-repository";

// Real in-memory SQLite so drizzle queries actually execute.
type TestDb = NonNullable<Parameters<typeof listSitemaps>[1]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE sitemap_entries (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    url text NOT NULL,
    urls text,
    last_fetched integer,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX sitemap_entries_blog_idx ON sitemap_entries (blog_id);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

const NOW = 1700000000000;

describe("sitemaps repository", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // listSitemaps
  // ---------------------------------------------------------------------------

  it("lists empty initially", async () => {
    expect(await listSitemaps("blog-1", db)).toEqual([]);
  });

  it("orders by lastFetched desc with id tiebreaker", async () => {
    await createSitemap(
      "blog-1",
      { url: "https://old.com/sitemap.xml", urls: [], lastFetched: NOW - 10000 },
      db,
    );
    await createSitemap(
      "blog-1",
      { url: "https://new.com/sitemap.xml", urls: [], lastFetched: NOW },
      db,
    );
    const list = await listSitemaps("blog-1", db);
    expect(list[0].url).toBe("https://new.com/sitemap.xml");
    expect(list[1].url).toBe("https://old.com/sitemap.xml");
  });

  // ---------------------------------------------------------------------------
  // createSitemap
  // ---------------------------------------------------------------------------

  it("creates a sitemap and returns an id", async () => {
    const result = await createSitemap(
      "blog-1",
      { url: "https://example.com/sitemap.xml", urls: [], lastFetched: NOW },
      db,
    );
    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
  });

  it("round-trips urls as a string array (JSON encode/decode)", async () => {
    const urls = [
      "https://example.com/post-1",
      "https://example.com/post-2",
      "https://example.com/post-3",
    ];
    await createSitemap(
      "blog-1",
      { url: "https://example.com/sitemap.xml", urls, lastFetched: NOW },
      db,
    );
    const list = await listSitemaps("blog-1", db);
    expect(list).toHaveLength(1);
    expect(list[0].urls).toEqual(urls);
    expect(typeof list[0].createdAt).toBe("number");
    expect(typeof list[0].updatedAt).toBe("number");
  });

  it("handles empty urls array", async () => {
    await createSitemap(
      "blog-1",
      { url: "https://example.com/sitemap.xml", urls: [], lastFetched: NOW },
      db,
    );
    const list = await listSitemaps("blog-1", db);
    expect(list[0].urls).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation — list
  // ---------------------------------------------------------------------------

  it("blog-a cannot list blog-b sitemaps", async () => {
    await createSitemap(
      "blog-a",
      { url: "https://a.com/sitemap.xml", urls: [], lastFetched: NOW },
      db,
    );
    expect(await listSitemaps("blog-b", db)).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // getSitemap
  // ---------------------------------------------------------------------------

  it("gets a sitemap by id", async () => {
    const { id } = await createSitemap(
      "blog-1",
      { url: "https://example.com/sitemap.xml", urls: ["https://example.com/a"], lastFetched: NOW },
      db,
    );
    const entry = await getSitemap("blog-1", id, db);
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe(id);
    expect(entry!.url).toBe("https://example.com/sitemap.xml");
    expect(entry!.urls).toEqual(["https://example.com/a"]);
    expect(entry!.lastFetched).toBe(NOW);
  });

  it("returns null for non-existent id", async () => {
    expect(await getSitemap("blog-1", "no-such-id", db)).toBeNull();
  });

  it("getSitemap is tenant-scoped", async () => {
    const { id } = await createSitemap(
      "blog-a",
      { url: "https://a.com/sitemap.xml", urls: [], lastFetched: NOW },
      db,
    );
    expect(await getSitemap("blog-b", id, db)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // listSitemapsForBlog
  // ---------------------------------------------------------------------------

  it("listSitemapsForBlog returns up to limit rows", async () => {
    for (let i = 0; i < 7; i++) {
      await createSitemap(
        "blog-1",
        { url: `https://example.com/sitemap${i}.xml`, urls: [], lastFetched: NOW + i },
        db,
      );
    }
    const result = await listSitemapsForBlog("blog-1", 5, db);
    expect(result).toHaveLength(5);
  });

  it("listSitemapsForBlog is scoped by blog_id", async () => {
    await createSitemap(
      "blog-a",
      { url: "https://a.com/sitemap.xml", urls: [], lastFetched: NOW },
      db,
    );
    expect(await listSitemapsForBlog("blog-b", 5, db)).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // updateSitemap
  // ---------------------------------------------------------------------------

  it("updates urls and lastFetched", async () => {
    const { id } = await createSitemap(
      "blog-1",
      { url: "https://example.com/sitemap.xml", urls: ["https://example.com/old"], lastFetched: NOW },
      db,
    );
    const newUrls = ["https://example.com/new-1", "https://example.com/new-2"];
    const updated = await updateSitemap("blog-1", id, { urls: newUrls, lastFetched: NOW + 5000 }, db);
    expect(updated).not.toBeNull();
    expect(updated!.urls).toEqual(newUrls);
    expect(updated!.lastFetched).toBe(NOW + 5000);
    expect(updated!.url).toBe("https://example.com/sitemap.xml"); // unchanged
  });

  it("returns null when updating non-existent id", async () => {
    expect(
      await updateSitemap("blog-1", "no-such-id", { urls: [], lastFetched: NOW }, db),
    ).toBeNull();
  });

  it("update is tenant-scoped — blog-b cannot update blog-a sitemap", async () => {
    const { id } = await createSitemap(
      "blog-a",
      { url: "https://a.com/sitemap.xml", urls: ["https://a.com/orig"], lastFetched: NOW },
      db,
    );
    const result = await updateSitemap("blog-b", id, { urls: ["https://hacked.com"], lastFetched: NOW }, db);
    expect(result).toBeNull();

    // Original still intact
    const still = await getSitemap("blog-a", id, db);
    expect(still!.urls).toEqual(["https://a.com/orig"]);
  });

  // ---------------------------------------------------------------------------
  // deleteSitemap
  // ---------------------------------------------------------------------------

  it("deletes a sitemap and returns true; second delete returns false", async () => {
    const { id } = await createSitemap(
      "blog-1",
      { url: "https://example.com/sitemap.xml", urls: [], lastFetched: NOW },
      db,
    );

    expect(await deleteSitemap("blog-1", id, db)).toBe(true);
    expect(await deleteSitemap("blog-1", id, db)).toBe(false);
    expect(await listSitemaps("blog-1", db)).toEqual([]);
  });

  it("returns false for non-existent id", async () => {
    expect(await deleteSitemap("blog-1", "phantom", db)).toBe(false);
  });

  it("delete is tenant-scoped — blog-b cannot delete blog-a sitemap", async () => {
    const { id } = await createSitemap(
      "blog-a",
      { url: "https://a.com/sitemap.xml", urls: [], lastFetched: NOW },
      db,
    );

    expect(await deleteSitemap("blog-b", id, db)).toBe(false);
    expect(await listSitemaps("blog-a", db)).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation — full combined test
  // ---------------------------------------------------------------------------

  it("sitemap in blog-a not visible/gettable/updatable/deletable from blog-b", async () => {
    const { id } = await createSitemap(
      "blog-a",
      { url: "https://private.com/sitemap.xml", urls: ["https://private.com/p1"], lastFetched: NOW },
      db,
    );

    // blog-b cannot list it
    expect(await listSitemaps("blog-b", db)).toEqual([]);
    // blog-b cannot get it
    expect(await getSitemap("blog-b", id, db)).toBeNull();
    // blog-b cannot update it
    expect(
      await updateSitemap("blog-b", id, { urls: ["https://evil.com"], lastFetched: NOW }, db),
    ).toBeNull();
    // blog-b cannot delete it
    expect(await deleteSitemap("blog-b", id, db)).toBe(false);
    // blog-a sitemap still intact
    const still = await getSitemap("blog-a", id, db);
    expect(still).not.toBeNull();
    expect(still!.urls).toEqual(["https://private.com/p1"]);
  });
});
