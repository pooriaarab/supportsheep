import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  createContextTag,
  deleteContextTag,
  getContextTag,
  listContextTags,
  updateContextTag,
} from "./repository";

// Real in-memory SQLite (libsql) so the drizzle queries actually run (async, like D1).
type TestDb = Parameters<typeof listContextTags>[1];

const BLOG = "default";

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE context_tags (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    name text NOT NULL,
    target_audience text DEFAULT '',
    tone text DEFAULT 'professional',
    style text DEFAULT 'informative',
    language text DEFAULT 'English',
    custom_prompt text DEFAULT '',
    article_length text,
    cta text,
    image_settings text,
    created_at text NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX context_tags_blog_idx ON context_tags (blog_id);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("context-tags repository", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  it("lists empty initially", async () => {
    expect(await listContextTags(BLOG, db)).toEqual([]);
  });

  it("creates a tag and round-trips all scalar fields and nested JSON objects", async () => {
    const input = {
      name: "Tech Startup Audience",
      targetAudience: "CTOs and startup founders",
      tone: "conversational",
      style: "persuasive",
      language: "English",
      customPrompt: "Focus on ROI",
      articleLength: { min: 800, max: 1500 },
      cta: { text: "Get started free", url: "https://example.com/signup" },
      imageSettings: {
        style: "minimalist",
        colorScheme: "blue-white",
        count: 2,
        aspectRatio: "4:3",
      },
    };
    const { id } = await createContextTag(BLOG, input, db);
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);

    const entry = await getContextTag(BLOG, id, db);
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe(id);
    expect(entry!.blogId).toBe(BLOG);
    expect(entry!.name).toBe("Tech Startup Audience");
    expect(entry!.targetAudience).toBe("CTOs and startup founders");
    expect(entry!.tone).toBe("conversational");
    expect(entry!.style).toBe("persuasive");
    expect(entry!.language).toBe("English");
    expect(entry!.customPrompt).toBe("Focus on ROI");
    // Nested JSON round-trips
    expect(entry!.articleLength).toEqual({ min: 800, max: 1500 });
    expect(entry!.cta).toEqual({ text: "Get started free", url: "https://example.com/signup" });
    expect(entry!.imageSettings).toEqual({
      style: "minimalist",
      colorScheme: "blue-white",
      count: 2,
      aspectRatio: "4:3",
    });
    expect(typeof entry!.createdAt).toBe("string");
  });

  it("creates a tag with defaults for omitted nested objects", async () => {
    const { id } = await createContextTag(BLOG, { name: "Minimal Tag" }, db);
    const entry = await getContextTag(BLOG, id, db);
    expect(entry).not.toBeNull();
    expect(entry!.name).toBe("Minimal Tag");
    expect(entry!.targetAudience).toBe("");
    expect(entry!.tone).toBe("professional");
    expect(entry!.style).toBe("informative");
    expect(entry!.language).toBe("English");
    expect(entry!.customPrompt).toBe("");
    expect(entry!.articleLength).toEqual({ min: 1000, max: 2000 });
    expect(entry!.cta).toEqual({ text: "", url: "" });
    expect(entry!.imageSettings).toEqual({
      style: "realistic",
      colorScheme: "",
      count: 3,
      aspectRatio: "16:9",
    });
  });

  it("lists tags ordered by name ascending", async () => {
    await createContextTag(BLOG, { name: "Zara Tag" }, db);
    await createContextTag(BLOG, { name: "Alice Tag" }, db);
    await createContextTag(BLOG, { name: "Mike Tag" }, db);
    const list = await listContextTags(BLOG, db);
    expect(list.map((t) => t.name)).toEqual(["Alice Tag", "Mike Tag", "Zara Tag"]);
  });

  it("returns null for a missing tag", async () => {
    expect(await getContextTag(BLOG, "no-such-id", db)).toBeNull();
  });

  it("updates partial scalar fields without changing others", async () => {
    const { id } = await createContextTag(BLOG, { name: "Original", tone: "formal" }, db);
    const updated = await updateContextTag(BLOG, id, { name: "Updated Name" }, db);
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("Updated Name");
    expect(updated!.tone).toBe("formal"); // unchanged
    expect(updated!.id).toBe(id);
  });

  it("updates nested JSON fields (partial patch round-trip)", async () => {
    const { id } = await createContextTag(
      BLOG,
      { name: "Tag", articleLength: { min: 500, max: 1000 } },
      db,
    );
    const updated = await updateContextTag(
      BLOG,
      id,
      { articleLength: { min: 800, max: 1600 } },
      db,
    );
    expect(updated!.articleLength).toEqual({ min: 800, max: 1600 });
  });

  it("returns null updating a missing tag", async () => {
    expect(await updateContextTag(BLOG, "no-such", { name: "X" }, db)).toBeNull();
  });

  it("deletes a tag", async () => {
    const { id } = await createContextTag(BLOG, { name: "Delete Me" }, db);
    expect(await deleteContextTag(BLOG, id, db)).toBe(true);
    expect(await deleteContextTag(BLOG, id, db)).toBe(false);
    expect(await listContextTags(BLOG, db)).toEqual([]);
  });

  it("returns false deleting a non-existent tag", async () => {
    expect(await deleteContextTag(BLOG, "phantom", db)).toBe(false);
  });

  it("isolates context tags by blogId — list, get, update, delete all scoped", async () => {
    const { id: idA } = await createContextTag("blog-a", { name: "Tag A" }, db);
    const { id: idB } = await createContextTag("blog-b", { name: "Tag B" }, db);

    // Lists are scoped
    expect((await listContextTags("blog-a", db)).map((t) => t.name)).toEqual(["Tag A"]);
    expect((await listContextTags("blog-b", db)).map((t) => t.name)).toEqual(["Tag B"]);

    // get from wrong blog returns null
    expect(await getContextTag("blog-b", idA, db)).toBeNull();
    expect(await getContextTag("blog-a", idB, db)).toBeNull();

    // update from wrong blog is a no-op (returns null)
    expect(await updateContextTag("blog-b", idA, { name: "Hijacked" }, db)).toBeNull();
    const still = await getContextTag("blog-a", idA, db);
    expect(still!.name).toBe("Tag A"); // untouched

    // delete from wrong blog returns false
    expect(await deleteContextTag("blog-b", idA, db)).toBe(false);
    expect(await getContextTag("blog-a", idA, db)).not.toBeNull(); // still there
  });
});
