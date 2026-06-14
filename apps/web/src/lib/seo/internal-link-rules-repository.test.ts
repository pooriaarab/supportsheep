import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  createInternalLinkRule,
  deleteInternalLinkRule,
  getInternalLinkRulesForBlog,
  listInternalLinkRules,
  updateInternalLinkRule,
} from "./internal-link-rules-repository";

// Real in-memory SQLite so drizzle queries actually execute.
type TestDb = NonNullable<Parameters<typeof listInternalLinkRules>[1]>;

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE internal_link_rules (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    keyword text NOT NULL,
    target_url text NOT NULL,
    max_per_article integer,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX internal_link_rules_blog_idx ON internal_link_rules (blog_id);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("internal-link-rules repository", () => {
  let db!: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // ---------------------------------------------------------------------------
  // listInternalLinkRules
  // ---------------------------------------------------------------------------

  it("lists empty initially", async () => {
    expect(await listInternalLinkRules("blog-1", db)).toEqual([]);
  });

  it("orders by keyword asc with id tiebreaker", async () => {
    await createInternalLinkRule(
      "blog-1",
      { keyword: "zebra", targetUrl: "https://example.com/z" },
      db,
    );
    await createInternalLinkRule(
      "blog-1",
      { keyword: "apple", targetUrl: "https://example.com/a" },
      db,
    );
    const list = await listInternalLinkRules("blog-1", db);
    expect(list.map((r) => r.keyword)).toEqual(["apple", "zebra"]);
  });

  // ---------------------------------------------------------------------------
  // createInternalLinkRule
  // ---------------------------------------------------------------------------

  it("creates a rule and returns an id", async () => {
    const result = await createInternalLinkRule(
      "blog-1",
      { keyword: "Next.js", targetUrl: "https://nextjs.org", maxPerArticle: 3 },
      db,
    );
    expect(typeof result.id).toBe("string");
    expect(result.id.length).toBeGreaterThan(0);
  });

  it("round-trips all fields via list", async () => {
    await createInternalLinkRule(
      "blog-1",
      { keyword: "React", targetUrl: "https://react.dev", maxPerArticle: 2 },
      db,
    );
    const list = await listInternalLinkRules("blog-1", db);
    expect(list).toHaveLength(1);
    const rule = list[0];
    expect(rule.keyword).toBe("React");
    expect(rule.targetUrl).toBe("https://react.dev");
    expect(rule.maxPerArticle).toBe(2);
    expect(rule.blogId).toBe("blog-1");
    expect(typeof rule.createdAt).toBe("number");
    expect(typeof rule.updatedAt).toBe("number");
  });

  it("allows null maxPerArticle", async () => {
    await createInternalLinkRule(
      "blog-1",
      { keyword: "TypeScript", targetUrl: "https://typescriptlang.org" },
      db,
    );
    const list = await listInternalLinkRules("blog-1", db);
    expect(list[0].maxPerArticle).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation — list
  // ---------------------------------------------------------------------------

  it("blog-a cannot list blog-b rules", async () => {
    await createInternalLinkRule(
      "blog-a",
      { keyword: "test", targetUrl: "https://example.com" },
      db,
    );
    expect(await listInternalLinkRules("blog-b", db)).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // getInternalLinkRulesForBlog
  // ---------------------------------------------------------------------------

  it("getInternalLinkRulesForBlog returns up to limit rows", async () => {
    for (let i = 0; i < 5; i++) {
      await createInternalLinkRule(
        "blog-1",
        { keyword: `kw${i}`, targetUrl: `https://example.com/${i}` },
        db,
      );
    }
    const result = await getInternalLinkRulesForBlog("blog-1", 3, db);
    expect(result).toHaveLength(3);
  });

  it("getInternalLinkRulesForBlog is scoped by blog_id", async () => {
    await createInternalLinkRule(
      "blog-a",
      { keyword: "a", targetUrl: "https://example.com/a" },
      db,
    );
    expect(await getInternalLinkRulesForBlog("blog-b", 50, db)).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // updateInternalLinkRule
  // ---------------------------------------------------------------------------

  it("updates partial fields and returns updated entry", async () => {
    await createInternalLinkRule(
      "blog-1",
      { keyword: "old", targetUrl: "https://old.com" },
      db,
    );
    const list = await listInternalLinkRules("blog-1", db);
    const id = list[0].id;

    const updated = await updateInternalLinkRule(
      "blog-1",
      id,
      { keyword: "new" },
      db,
    );
    expect(updated).not.toBeNull();
    expect(updated?.keyword).toBe("new");
    expect(updated?.targetUrl).toBe("https://old.com"); // unchanged
  });

  it("returns null when updating non-existent id", async () => {
    expect(
      await updateInternalLinkRule("blog-1", "no-such-id", { keyword: "x" }, db),
    ).toBeNull();
  });

  it("update is tenant-scoped — blog-b cannot update blog-a rule", async () => {
    await createInternalLinkRule(
      "blog-a",
      { keyword: "original", targetUrl: "https://example.com" },
      db,
    );
    const [rule] = await listInternalLinkRules("blog-a", db);

    const result = await updateInternalLinkRule(
      "blog-b",
      rule.id,
      { keyword: "hacked" },
      db,
    );
    expect(result).toBeNull();

    // Original unchanged
    const [still] = await listInternalLinkRules("blog-a", db);
    expect(still.keyword).toBe("original");
  });

  // ---------------------------------------------------------------------------
  // deleteInternalLinkRule
  // ---------------------------------------------------------------------------

  it("deletes a rule and returns true; second delete returns false", async () => {
    await createInternalLinkRule(
      "blog-1",
      { keyword: "del", targetUrl: "https://example.com" },
      db,
    );
    const [rule] = await listInternalLinkRules("blog-1", db);

    expect(await deleteInternalLinkRule("blog-1", rule.id, db)).toBe(true);
    expect(await deleteInternalLinkRule("blog-1", rule.id, db)).toBe(false);
    expect(await listInternalLinkRules("blog-1", db)).toEqual([]);
  });

  it("returns false for non-existent id", async () => {
    expect(await deleteInternalLinkRule("blog-1", "phantom", db)).toBe(false);
  });

  it("delete is tenant-scoped — blog-b cannot delete blog-a rule", async () => {
    await createInternalLinkRule(
      "blog-a",
      { keyword: "safe", targetUrl: "https://example.com" },
      db,
    );
    const [rule] = await listInternalLinkRules("blog-a", db);

    expect(await deleteInternalLinkRule("blog-b", rule.id, db)).toBe(false);
    expect(await listInternalLinkRules("blog-a", db)).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation — full combined test
  // ---------------------------------------------------------------------------

  it("rule in blog-a not visible/updatable/deletable from blog-b", async () => {
    await createInternalLinkRule(
      "blog-a",
      { keyword: "private", targetUrl: "https://private.com" },
      db,
    );
    const [ruleA] = await listInternalLinkRules("blog-a", db);

    // blog-b cannot list it
    expect(await listInternalLinkRules("blog-b", db)).toEqual([]);
    // blog-b cannot update it
    expect(
      await updateInternalLinkRule("blog-b", ruleA.id, { keyword: "stolen" }, db),
    ).toBeNull();
    // blog-b cannot delete it
    expect(await deleteInternalLinkRule("blog-b", ruleA.id, db)).toBe(false);
    // blog-a rule still intact
    const still = await listInternalLinkRules("blog-a", db);
    expect(still).toHaveLength(1);
    expect(still[0].keyword).toBe("private");
  });
});
