/**
 * Unit tests for the blog-settings D1 repository functions.
 *
 * Uses real in-memory SQLite (libsql) matching the categories test pattern.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { getBlogSettings, updateBlogSettings } from "./repository";

type TestDb = Parameters<typeof getBlogSettings>[1];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`
    CREATE TABLE blog_settings (
      blog_id    text    PRIMARY KEY NOT NULL,
      data       text    NOT NULL,
      updated_at integer NOT NULL
    );
  `);
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("blog-settings repository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  it("returns defaults when no row exists", async () => {
    const settings = await getBlogSettings("default", db);
    expect(settings).toMatchObject({
      appName: "My App",
      theme: "system",
      notifications: { email: true, push: false },
    });
  });

  it("stores and retrieves a patch (round-trip)", async () => {
    await updateBlogSettings("default", { appName: "BlogBat" }, db);
    const settings = await getBlogSettings("default", db);
    expect(settings.appName).toBe("BlogBat");
    // defaults still applied for unset fields
    expect(settings.theme).toBe("system");
  });

  it("deep-merges nested fields on repeated PATCHes", async () => {
    await updateBlogSettings("default", { notifications: { email: false } }, db);
    const settings = await getBlogSettings("default", db);
    // email overridden, push keeps default
    expect(settings.notifications).toEqual({ email: false, push: false });
  });

  it("second updateBlogSettings call merges into first", async () => {
    await updateBlogSettings("default", { appName: "First", theme: "dark" }, db);
    await updateBlogSettings("default", { appName: "Second" }, db);
    const settings = await getBlogSettings("default", db);
    expect(settings.appName).toBe("Second");
    expect(settings.theme).toBe("dark");
  });

  it("isolates settings by blogId (tenant isolation)", async () => {
    await updateBlogSettings("blog-a", { appName: "A" }, db);
    await updateBlogSettings("blog-b", { appName: "B" }, db);

    const a = await getBlogSettings("blog-a", db);
    const b = await getBlogSettings("blog-b", db);

    expect(a.appName).toBe("A");
    expect(b.appName).toBe("B");

    // default blog unaffected
    const def = await getBlogSettings("default", db);
    expect(def.appName).toBe("My App");
  });
});
