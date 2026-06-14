import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

import {
  BUILTIN_SKILLS,
  createWritingSkill,
  deleteWritingSkill,
  getWritingSkill,
  listWritingSkills,
  reorderWritingSkills,
  seedBuiltinSkills,
  updateWritingSkill,
} from "./repository";

// Real in-memory SQLite (libsql) so the drizzle queries actually run (async, like D1).
type TestDb = Parameters<typeof listWritingSkills>[1];

const BLOG = "default";

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE writing_skills (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'custom' NOT NULL,
    description text DEFAULT '' NOT NULL,
    prompt text DEFAULT '' NOT NULL,
    provider text DEFAULT 'claude' NOT NULL,
    model text DEFAULT '' NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    enabled integer DEFAULT true NOT NULL,
    created_at text NOT NULL,
    updated_at text NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX writing_skills_blog_idx ON writing_skills (blog_id);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

describe("writing-skills repository", () => {
  let db: TestDb;
  beforeEach(async () => {
    db = await makeDb();
  });

  // -------------------------------------------------------------------------
  // listWritingSkills
  // -------------------------------------------------------------------------

  it("lists empty initially", async () => {
    expect(await listWritingSkills(BLOG, db)).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // createWritingSkill + nextOrder
  // -------------------------------------------------------------------------

  it("creates a skill with type=custom and all fields", async () => {
    const skill = await createWritingSkill(
      BLOG,
      {
        name: "My Skill",
        description: "A helpful skill",
        prompt: "Do something useful",
        provider: "claude",
        model: "claude-3-5-haiku-20241022",
        enabled: true,
      },
      db,
    );

    expect(skill.type).toBe("custom");
    expect(skill.blogId).toBe(BLOG);
    expect(skill.name).toBe("My Skill");
    expect(skill.description).toBe("A helpful skill");
    expect(skill.prompt).toBe("Do something useful");
    expect(skill.provider).toBe("claude");
    expect(skill.model).toBe("claude-3-5-haiku-20241022");
    expect(skill.enabled).toBe(true);
    expect(typeof skill.id).toBe("string");
    expect(skill.id.length).toBeGreaterThan(0);
    expect(typeof skill.createdAt).toBe("string");
    expect(typeof skill.updatedAt).toBe("string");
  });

  it("assigns order=0 for first skill, increments for subsequent", async () => {
    const a = await createWritingSkill(BLOG, { name: "A", prompt: "pa" }, db);
    const b = await createWritingSkill(BLOG, { name: "B", prompt: "pb" }, db);
    const c = await createWritingSkill(BLOG, { name: "C", prompt: "pc" }, db);
    expect(a.order).toBe(0);
    expect(b.order).toBe(1);
    expect(c.order).toBe(2);
  });

  it("creates with defaults for optional fields", async () => {
    const skill = await createWritingSkill(BLOG, { name: "Min", prompt: "p" }, db);
    expect(skill.description).toBe("");
    expect(skill.provider).toBe("claude");
    expect(skill.model).toBe("");
    expect(skill.enabled).toBe(true);
    expect(skill.type).toBe("custom");
  });

  // -------------------------------------------------------------------------
  // getWritingSkill
  // -------------------------------------------------------------------------

  it("gets a skill by id (scoped to blogId)", async () => {
    const created = await createWritingSkill(BLOG, { name: "Get Me", prompt: "p" }, db);
    const found = await getWritingSkill(BLOG, created.id, db);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe("Get Me");
  });

  it("returns null for a missing skill", async () => {
    expect(await getWritingSkill(BLOG, "no-such-id", db)).toBeNull();
  });

  it("returns null when id belongs to a different blog", async () => {
    const skill = await createWritingSkill("blog-a", { name: "A", prompt: "p" }, db);
    expect(await getWritingSkill("blog-b", skill.id, db)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // listWritingSkills — ordering
  // -------------------------------------------------------------------------

  it("lists skills ordered by order asc", async () => {
    const a = await createWritingSkill(BLOG, { name: "A", prompt: "p" }, db);
    const b = await createWritingSkill(BLOG, { name: "B", prompt: "p" }, db);
    // Manually reorder so B is before A
    await reorderWritingSkills(BLOG, { [a.id]: 10, [b.id]: 1 }, db);
    const list = await listWritingSkills(BLOG, db);
    expect(list.map((s) => s.name)).toEqual(["B", "A"]);
  });

  // -------------------------------------------------------------------------
  // updateWritingSkill
  // -------------------------------------------------------------------------

  it("updates partial fields and returns updated entry", async () => {
    const skill = await createWritingSkill(
      BLOG,
      { name: "Original", prompt: "old prompt", description: "old desc" },
      db,
    );
    const updated = await updateWritingSkill(BLOG, skill.id, { name: "Updated" }, db);
    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("Updated");
    expect(updated?.prompt).toBe("old prompt"); // unchanged
    expect(updated?.description).toBe("old desc"); // unchanged
  });

  it("updates enabled field", async () => {
    const skill = await createWritingSkill(BLOG, { name: "S", prompt: "p", enabled: true }, db);
    const updated = await updateWritingSkill(BLOG, skill.id, { enabled: false }, db);
    expect(updated?.enabled).toBe(false);
  });

  it("returns null updating a missing skill", async () => {
    expect(await updateWritingSkill(BLOG, "no-such-id", { name: "X" }, db)).toBeNull();
  });

  it("update is scoped by blogId — cannot update across blogs", async () => {
    const skill = await createWritingSkill("blog-a", { name: "Skill A", prompt: "p" }, db);
    const result = await updateWritingSkill("blog-b", skill.id, { name: "Hacked" }, db);
    expect(result).toBeNull();
    // Original is unchanged
    const original = await getWritingSkill("blog-a", skill.id, db);
    expect(original?.name).toBe("Skill A");
  });

  // -------------------------------------------------------------------------
  // deleteWritingSkill
  // -------------------------------------------------------------------------

  it("deletes a skill and returns true; second delete returns false", async () => {
    const skill = await createWritingSkill(BLOG, { name: "Del", prompt: "p" }, db);
    expect(await deleteWritingSkill(BLOG, skill.id, db)).toBe(true);
    expect(await deleteWritingSkill(BLOG, skill.id, db)).toBe(false);
    expect(await listWritingSkills(BLOG, db)).toEqual([]);
  });

  it("delete is scoped by blogId", async () => {
    const skill = await createWritingSkill("blog-a", { name: "S", prompt: "p" }, db);
    expect(await deleteWritingSkill("blog-b", skill.id, db)).toBe(false);
    // Still exists in blog-a
    expect(await getWritingSkill("blog-a", skill.id, db)).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // reorderWritingSkills
  // -------------------------------------------------------------------------

  it("reorders skills atomically and returns count", async () => {
    const a = await createWritingSkill(BLOG, { name: "A", prompt: "p" }, db);
    const b = await createWritingSkill(BLOG, { name: "B", prompt: "p" }, db);
    const c = await createWritingSkill(BLOG, { name: "C", prompt: "p" }, db);

    const n = await reorderWritingSkills(
      BLOG,
      { [a.id]: 20, [b.id]: 5, [c.id]: 10 },
      db,
    );
    expect(n).toBe(3);

    const list = await listWritingSkills(BLOG, db);
    expect(list.map((s) => s.name)).toEqual(["B", "C", "A"]);
  });

  it("returns 0 for empty reorder map (no-op)", async () => {
    expect(await reorderWritingSkills(BLOG, {}, db)).toBe(0);
  });

  it("reorder is scoped by blogId", async () => {
    const skill = await createWritingSkill("blog-a", { name: "S", prompt: "p" }, db);
    // Reorder from blog-b with skill id from blog-a should not affect blog-a
    await reorderWritingSkills("blog-b", { [skill.id]: 99 }, db);
    const result = await getWritingSkill("blog-a", skill.id, db);
    expect(result?.order).toBe(0); // unchanged
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  it("isolates skills by blogId — same-blog queries only see their own skills", async () => {
    await createWritingSkill("blog-a", { name: "Skill for A", prompt: "p" }, db);
    await createWritingSkill("blog-b", { name: "Skill for B", prompt: "p" }, db);

    const a = await listWritingSkills("blog-a", db);
    const b = await listWritingSkills("blog-b", db);
    expect(a.map((s) => s.name)).toEqual(["Skill for A"]);
    expect(b.map((s) => s.name)).toEqual(["Skill for B"]);

    // Deleting from blog-a must not touch blog-b.
    expect(await deleteWritingSkill("blog-a", a[0].id, db)).toBe(true);
    expect(await listWritingSkills("blog-a", db)).toEqual([]);
    expect(await listWritingSkills("blog-b", db)).toHaveLength(1);
  });

  it("nextOrder is per-blog — different blogs track independently", async () => {
    const a1 = await createWritingSkill("blog-a", { name: "A1", prompt: "p" }, db);
    const a2 = await createWritingSkill("blog-a", { name: "A2", prompt: "p" }, db);
    const b1 = await createWritingSkill("blog-b", { name: "B1", prompt: "p" }, db);
    expect(a1.order).toBe(0);
    expect(a2.order).toBe(1);
    expect(b1.order).toBe(0); // blog-b starts fresh
  });

  // -------------------------------------------------------------------------
  // seedBuiltinSkills
  // -------------------------------------------------------------------------

  it("seeds the 5 builtin skills when blog has none", async () => {
    await seedBuiltinSkills(BLOG, db);
    const list = await listWritingSkills(BLOG, db);
    expect(list).toHaveLength(5);
    expect(list.every((s) => s.type === "builtin")).toBe(true);
    expect(list.every((s) => s.enabled === true)).toBe(true);
    expect(list.map((s) => s.name)).toEqual(
      BUILTIN_SKILLS.map((s) => s.name),
    );
    // Must be ordered 0-4
    expect(list.map((s) => s.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it("seed is idempotent — no-op when skills already exist", async () => {
    await createWritingSkill(BLOG, { name: "Existing", prompt: "p" }, db);
    await seedBuiltinSkills(BLOG, db);
    const list = await listWritingSkills(BLOG, db);
    // Still only 1 skill (the pre-existing one); no builtin seeding occurred.
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Existing");
  });

  it("calling seedBuiltinSkills twice is idempotent", async () => {
    await seedBuiltinSkills(BLOG, db);
    await seedBuiltinSkills(BLOG, db);
    expect(await listWritingSkills(BLOG, db)).toHaveLength(5);
  });

  it("seed is per-blog — seeding blog-a does not affect blog-b", async () => {
    await seedBuiltinSkills("blog-a", db);
    expect(await listWritingSkills("blog-b", db)).toHaveLength(0);
    expect(await listWritingSkills("blog-a", db)).toHaveLength(5);
  });

  it("BUILTIN_SKILLS catalog has exactly 5 entries with the expected names", () => {
    expect(BUILTIN_SKILLS).toHaveLength(5);
    const names = BUILTIN_SKILLS.map((s) => s.name);
    expect(names).toContain("Humanizer");
    expect(names).toContain("Brand Voice");
    expect(names).toContain("SEO Optimizer");
    expect(names).toContain("Readability");
    expect(names).toContain("Fact Checker");
  });
});
