import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  createImport,
  getImport,
  listImports,
  updateImport,
} from "./imports-repository";

// Real in-memory SQLite (libsql) so drizzle queries actually run.
type TestDb = NonNullable<Parameters<typeof listImports>[2]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE wordpress_imports (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    source text DEFAULT 'wordpress' NOT NULL,
    status text DEFAULT 'running' NOT NULL,
    total_posts integer DEFAULT 0 NOT NULL,
    imported_posts integer DEFAULT 0 NOT NULL,
    rehosted_images integer DEFAULT 0 NOT NULL,
    failed_posts text DEFAULT '[]' NOT NULL,
    created_by text,
    started_at integer,
    completed_at integer,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX wordpress_imports_blog_idx ON wordpress_imports (blog_id);`,
  );
  await client.execute(
    `CREATE INDEX wordpress_imports_blog_created_idx ON wordpress_imports (blog_id, created_at);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("imports-repository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  describe("createImport", () => {
    it("creates an import job with running status and correct fields", async () => {
      const entry = await createImport(
        "blog-a",
        { totalPosts: 42, createdBy: "user-1" },
        db,
      );

      expect(entry.blogId).toBe("blog-a");
      expect(entry.source).toBe("wordpress");
      expect(entry.status).toBe("running");
      expect(entry.totalPosts).toBe(42);
      expect(entry.importedPosts).toBe(0);
      expect(entry.rehostedImages).toBe(0);
      expect(entry.failedPosts).toEqual([]);
      expect(entry.createdBy).toBe("user-1");
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.createdAt).toBe("number");
      expect(entry.createdAt).toBeGreaterThan(0);
      expect(entry.completedAt).toBeNull();
    });

    it("accepts optional createdBy", async () => {
      const entry = await createImport("blog-a", { totalPosts: 5 }, db);
      expect(entry.createdBy).toBeNull();
    });
  });

  describe("getImport", () => {
    it("returns the created import by id", async () => {
      const created = await createImport("blog-a", { totalPosts: 10 }, db);
      const fetched = await getImport("blog-a", created.id, db);

      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.totalPosts).toBe(10);
    });

    it("returns null for unknown id", async () => {
      const result = await getImport("blog-a", "nonexistent", db);
      expect(result).toBeNull();
    });

    it("enforces tenant isolation — same id, different blog returns null", async () => {
      const entry = await createImport("blog-a", { totalPosts: 3 }, db);
      const result = await getImport("blog-b", entry.id, db);
      expect(result).toBeNull();
    });
  });

  describe("listImports", () => {
    it("returns empty array when no imports exist", async () => {
      const list = await listImports("blog-a", {}, db);
      expect(list).toEqual([]);
    });

    it("only returns imports for the given blog", async () => {
      await createImport("blog-a", { totalPosts: 1 }, db);
      await createImport("blog-b", { totalPosts: 2 }, db);
      await createImport("blog-a", { totalPosts: 3 }, db);

      const listA = await listImports("blog-a", {}, db);
      const listB = await listImports("blog-b", {}, db);

      expect(listA).toHaveLength(2);
      expect(listB).toHaveLength(1);
      expect(listA.every((e) => e.blogId === "blog-a")).toBe(true);
      expect(listB[0].blogId).toBe("blog-b");
    });

    it("respects the limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await createImport("blog-a", { totalPosts: i + 1 }, db);
      }
      const list = await listImports("blog-a", { limit: 3 }, db);
      expect(list).toHaveLength(3);
    });
  });

  describe("updateImport", () => {
    it("updates status and completedAt", async () => {
      const created = await createImport("blog-a", { totalPosts: 10 }, db);
      const now = Date.now();

      const updated = await updateImport(
        "blog-a",
        created.id,
        { status: "completed", completedAt: now },
        db,
      );

      expect(updated?.status).toBe("completed");
      expect(updated?.completedAt).toBe(now);
    });

    it("updates importedPosts and rehostedImages", async () => {
      const created = await createImport("blog-a", { totalPosts: 10 }, db);

      const updated = await updateImport(
        "blog-a",
        created.id,
        { importedPosts: 7, rehostedImages: 3 },
        db,
      );

      expect(updated?.importedPosts).toBe(7);
      expect(updated?.rehostedImages).toBe(3);
    });

    it("round-trips failedPosts JSON correctly", async () => {
      const created = await createImport("blog-a", { totalPosts: 5 }, db);
      const failedPosts = [
        { slug: "my-post", error: "timeout" },
        { slug: "other-post", error: "network failure" },
      ];

      const updated = await updateImport(
        "blog-a",
        created.id,
        { failedPosts },
        db,
      );

      expect(updated?.failedPosts).toEqual(failedPosts);

      // Confirm it round-trips through getImport as well
      const fetched = await getImport("blog-a", created.id, db);
      expect(fetched?.failedPosts).toEqual(failedPosts);
    });

    it("returns null for unknown id", async () => {
      const result = await updateImport(
        "blog-a",
        "nonexistent",
        { status: "failed" },
        db,
      );
      expect(result).toBeNull();
    });

    it("enforces tenant isolation on update", async () => {
      const created = await createImport("blog-a", { totalPosts: 10 }, db);
      const result = await updateImport(
        "blog-b",
        created.id,
        { status: "failed" },
        db,
      );
      expect(result).toBeNull();

      // Original record unchanged
      const original = await getImport("blog-a", created.id, db);
      expect(original?.status).toBe("running");
    });
  });
});
