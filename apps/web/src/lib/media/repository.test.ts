import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  createMedia,
  deleteMedia,
  getMedia,
  listMedia,
  updateMedia,
} from "./repository";

// Real in-memory SQLite (libsql) so drizzle queries actually run.
type TestDb = NonNullable<Parameters<typeof listMedia>[2]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE media (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    filename text NOT NULL,
    url text NOT NULL,
    storage_path text DEFAULT '' NOT NULL,
    mime_type text DEFAULT '' NOT NULL,
    size integer DEFAULT 0 NOT NULL,
    width integer DEFAULT 0 NOT NULL,
    height integer DEFAULT 0 NOT NULL,
    alt text DEFAULT '' NOT NULL,
    uploaded_by text DEFAULT '' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX media_blog_idx ON media (blog_id);`,
  );
  await client.execute(
    `CREATE INDEX media_blog_created_idx ON media (blog_id, created_at);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

async function seed(
  db: TestDb,
  blogId: string,
  overrides: Partial<Parameters<typeof createMedia>[1]> = {},
) {
  return createMedia(
    blogId,
    {
      filename: "photo.jpg",
      url: "https://storage.googleapis.com/bucket/photo.jpg",
      storagePath: "images/photo.jpg",
      mimeType: "image/jpeg",
      size: 12345,
      ...overrides,
    },
    db,
  );
}

describe("media repository", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // listMedia
  // ---------------------------------------------------------------------------

  it("returns empty array for a fresh blog", async () => {
    expect(await listMedia("blog-1", {}, db)).toEqual([]);
  });

  it("orders by created_at desc", async () => {
    const { media } = schema;
    await db.insert(media).values([
      {
        id: "a",
        blogId: "blog-1",
        filename: "old.jpg",
        url: "https://example.com/old.jpg",
        storagePath: "images/old.jpg",
        mimeType: "image/jpeg",
        size: 100,
        width: 0,
        height: 0,
        alt: "",
        uploadedBy: "",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: "b",
        blogId: "blog-1",
        filename: "new.jpg",
        url: "https://example.com/new.jpg",
        storagePath: "images/new.jpg",
        mimeType: "image/jpeg",
        size: 200,
        width: 0,
        height: 0,
        alt: "",
        uploadedBy: "",
        createdAt: 2000,
        updatedAt: 2000,
      },
    ]);
    const list = await listMedia("blog-1", {}, db);
    expect(list.map((m) => m.id)).toEqual(["b", "a"]);
  });

  it("id tiebreaker makes ordering deterministic for same-millisecond rows", async () => {
    const { media } = schema;
    await db.insert(media).values([
      {
        id: "aaa",
        blogId: "blog-1",
        filename: "a.jpg",
        url: "https://example.com/a.jpg",
        storagePath: "images/a.jpg",
        mimeType: "image/jpeg",
        size: 1,
        width: 0,
        height: 0,
        alt: "",
        uploadedBy: "",
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: "zzz",
        blogId: "blog-1",
        filename: "z.jpg",
        url: "https://example.com/z.jpg",
        storagePath: "images/z.jpg",
        mimeType: "image/jpeg",
        size: 1,
        width: 0,
        height: 0,
        alt: "",
        uploadedBy: "",
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]);
    const ids = (await listMedia("blog-1", {}, db)).map((m) => m.id);
    expect(ids).toEqual(["zzz", "aaa"]);
  });

  it("respects the limit option", async () => {
    for (let i = 0; i < 5; i++) {
      await seed(db, "blog-1", { filename: `img${i}.jpg` });
    }
    const result = await listMedia("blog-1", { limit: 3 }, db);
    expect(result).toHaveLength(3);
  });

  it("respects the offset option", async () => {
    const { media } = schema;
    await db.insert(media).values([
      {
        id: "x1",
        blogId: "blog-1",
        filename: "x1.jpg",
        url: "u1",
        storagePath: "s1",
        mimeType: "image/jpeg",
        size: 1,
        width: 0,
        height: 0,
        alt: "",
        uploadedBy: "",
        createdAt: 3000,
        updatedAt: 3000,
      },
      {
        id: "x2",
        blogId: "blog-1",
        filename: "x2.jpg",
        url: "u2",
        storagePath: "s2",
        mimeType: "image/jpeg",
        size: 1,
        width: 0,
        height: 0,
        alt: "",
        uploadedBy: "",
        createdAt: 2000,
        updatedAt: 2000,
      },
      {
        id: "x3",
        blogId: "blog-1",
        filename: "x3.jpg",
        url: "u3",
        storagePath: "s3",
        mimeType: "image/jpeg",
        size: 1,
        width: 0,
        height: 0,
        alt: "",
        uploadedBy: "",
        createdAt: 1000,
        updatedAt: 1000,
      },
    ]);
    const page1 = await listMedia("blog-1", { limit: 2, offset: 0 }, db);
    const page2 = await listMedia("blog-1", { limit: 2, offset: 2 }, db);
    expect(page1.map((m) => m.id)).toEqual(["x1", "x2"]);
    expect(page2.map((m) => m.id)).toEqual(["x3"]);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation
  // ---------------------------------------------------------------------------

  it("blog-a cannot list blog-b items", async () => {
    await seed(db, "blog-a");
    expect(await listMedia("blog-b", {}, db)).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // createMedia
  // ---------------------------------------------------------------------------

  it("creates entry and returns full shape", async () => {
    const before = Date.now();
    const result = await createMedia(
      "blog-1",
      {
        filename: "cat.png",
        url: "https://example.com/cat.png",
        storagePath: "images/cat.png",
        mimeType: "image/png",
        size: 8000,
        width: 640,
        height: 480,
        alt: "A cat",
        uploadedBy: "user-1",
      },
      db,
    );
    const after = Date.now();

    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.blogId).toBe("blog-1");
    expect(result.filename).toBe("cat.png");
    expect(result.url).toBe("https://example.com/cat.png");
    expect(result.storagePath).toBe("images/cat.png");
    expect(result.mimeType).toBe("image/png");
    expect(result.size).toBe(8000);
    expect(result.width).toBe(640);
    expect(result.height).toBe(480);
    expect(result.alt).toBe("A cat");
    expect(result.uploadedBy).toBe("user-1");
    expect(result.createdAt).toBeGreaterThanOrEqual(before);
    expect(result.createdAt).toBeLessThanOrEqual(after);
    expect(result.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("defaults optional fields", async () => {
    const result = await createMedia(
      "blog-1",
      {
        filename: "bare.jpg",
        url: "https://example.com/bare.jpg",
        mimeType: "image/jpeg",
        size: 1000,
      },
      db,
    );
    expect(result.storagePath).toBe("");
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
    expect(result.alt).toBe("");
    expect(result.uploadedBy).toBe("");
  });

  it("accepts an explicit id", async () => {
    const result = await createMedia(
      "blog-1",
      {
        id: "explicit-id",
        filename: "x.jpg",
        url: "u",
        mimeType: "image/jpeg",
        size: 1,
      },
      db,
    );
    expect(result.id).toBe("explicit-id");
  });

  // ---------------------------------------------------------------------------
  // getMedia
  // ---------------------------------------------------------------------------

  it("gets an item by id", async () => {
    const created = await seed(db, "blog-1");
    const fetched = await getMedia("blog-1", created.id, db);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.filename).toBe("photo.jpg");
  });

  it("returns null for unknown id", async () => {
    expect(await getMedia("blog-1", "no-such-id", db)).toBeNull();
  });

  it("get is scoped by blog_id", async () => {
    const created = await seed(db, "blog-a");
    expect(await getMedia("blog-b", created.id, db)).toBeNull();
    expect(await getMedia("blog-a", created.id, db)).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // updateMedia
  // ---------------------------------------------------------------------------

  it("updates alt text and bumps updatedAt", async () => {
    const created = await seed(db, "blog-1");
    const before = Date.now();
    const updated = await updateMedia("blog-1", created.id, { alt: "new alt" }, db);
    const after = Date.now();

    expect(updated).not.toBeNull();
    expect(updated?.alt).toBe("new alt");
    expect(updated?.updatedAt).toBeGreaterThanOrEqual(before);
    expect(updated?.updatedAt).toBeLessThanOrEqual(after);
  });

  it("returns null when updating a non-existent item", async () => {
    expect(await updateMedia("blog-1", "no-such-id", { alt: "x" }, db)).toBeNull();
  });

  it("update is scoped by blog_id", async () => {
    const created = await seed(db, "blog-a");
    expect(await updateMedia("blog-b", created.id, { alt: "x" }, db)).toBeNull();
  });

  it("no-op update (no fields) still succeeds", async () => {
    const created = await seed(db, "blog-1");
    const updated = await updateMedia("blog-1", created.id, {}, db);
    expect(updated).not.toBeNull();
    expect(updated?.filename).toBe("photo.jpg");
  });

  // ---------------------------------------------------------------------------
  // deleteMedia
  // ---------------------------------------------------------------------------

  it("deletes and returns the deleted entry", async () => {
    const created = await seed(db, "blog-1");
    const deleted = await deleteMedia("blog-1", created.id, db);
    expect(deleted?.id).toBe(created.id);
    expect(await getMedia("blog-1", created.id, db)).toBeNull();
  });

  it("returns null when deleting a non-existent item", async () => {
    expect(await deleteMedia("blog-1", "no-such-id", db)).toBeNull();
  });

  it("delete is scoped by blog_id", async () => {
    const created = await seed(db, "blog-a");
    expect(await deleteMedia("blog-b", created.id, db)).toBeNull();
    expect(await getMedia("blog-a", created.id, db)).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // listMedia — type (mime family) filter
  // ---------------------------------------------------------------------------

  it("filters by type=image (mime image/*)", async () => {
    await seed(db, "blog-1", { filename: "a.png", mimeType: "image/png" });
    await seed(db, "blog-1", { filename: "b.mp4", mimeType: "video/mp4" });
    await seed(db, "blog-1", { filename: "c.pdf", mimeType: "application/pdf" });

    const images = await listMedia("blog-1", { type: "image" }, db);
    expect(images.map((m) => m.filename)).toEqual(["a.png"]);
  });

  it("filters by type=video (mime video/*)", async () => {
    await seed(db, "blog-1", { filename: "a.png", mimeType: "image/png" });
    await seed(db, "blog-1", { filename: "b.mp4", mimeType: "video/mp4" });

    const videos = await listMedia("blog-1", { type: "video" }, db);
    expect(videos.map((m) => m.filename)).toEqual(["b.mp4"]);
  });

  it("filters by type=document (application/* and text/*)", async () => {
    await seed(db, "blog-1", { filename: "a.png", mimeType: "image/png" });
    await seed(db, "blog-1", { filename: "b.pdf", mimeType: "application/pdf" });
    await seed(db, "blog-1", { filename: "c.txt", mimeType: "text/plain" });

    const docs = await listMedia("blog-1", { type: "document" }, db);
    expect(docs.map((m) => m.filename).sort()).toEqual(["b.pdf", "c.txt"]);
  });

  it("filters by type=other (none of image/video/document families)", async () => {
    await seed(db, "blog-1", { filename: "a.png", mimeType: "image/png" });
    await seed(db, "blog-1", { filename: "b.bin", mimeType: "audio/mpeg" });

    const others = await listMedia("blog-1", { type: "other" }, db);
    expect(others.map((m) => m.filename)).toEqual(["b.bin"]);
  });

  it("type filter still respects blog scoping", async () => {
    await seed(db, "blog-a", { filename: "a.png", mimeType: "image/png" });
    expect(await listMedia("blog-b", { type: "image" }, db)).toEqual([]);
  });

  it("no type filter returns all families", async () => {
    await seed(db, "blog-1", { filename: "a.png", mimeType: "image/png" });
    await seed(db, "blog-1", { filename: "b.mp4", mimeType: "video/mp4" });
    expect(await listMedia("blog-1", {}, db)).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation — combined
  // ---------------------------------------------------------------------------

  it("blog-a items are invisible to blog-b across all ops", async () => {
    const item = await seed(db, "blog-a", { filename: "private.jpg" });

    expect(await listMedia("blog-b", {}, db)).toEqual([]);
    expect(await getMedia("blog-b", item.id, db)).toBeNull();
    expect(await updateMedia("blog-b", item.id, { alt: "x" }, db)).toBeNull();
    expect(await deleteMedia("blog-b", item.id, db)).toBeNull();

    // still intact in blog-a
    const still = await listMedia("blog-a", {}, db);
    expect(still).toHaveLength(1);
    expect(still[0].filename).toBe("private.jpg");
  });
});
