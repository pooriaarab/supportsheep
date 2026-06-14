import type { FreeTool } from "@repo/types";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import { freeTools as freeToolsTable } from "@/db/schema/free-tools";

import {
  getFreeToolById,
  hasDuplicateFreeToolSlug,
  hasEnabledPublicFreeTools,
  isSafeFreeToolSlug,
  listEnabledPublicFreeTools,
  listFreeTools,
  patchFreeTool,
  resolvePublicFreeToolBySlug,
  seedDefaultFreeTools,
} from "./repository";

// ---------------------------------------------------------------------------
// In-memory SQLite setup (real drizzle queries)
// ---------------------------------------------------------------------------

type TestDb = Parameters<typeof listFreeTools>[1];

async function makeDb(): Promise<TestDb> {
  const client = createClient({ url: ":memory:" });
  await client.execute(`CREATE TABLE free_tools (
    id text PRIMARY KEY NOT NULL,
    blog_id text DEFAULT 'default' NOT NULL,
    template_id text NOT NULL,
    source text DEFAULT 'predefined' NOT NULL,
    enabled integer DEFAULT false NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    meta_title text DEFAULT '' NOT NULL,
    meta_description text DEFAULT '' NOT NULL,
    intro text DEFAULT '' NOT NULL,
    faq text DEFAULT '[]' NOT NULL,
    cta text DEFAULT '{}' NOT NULL,
    callout text DEFAULT '{}' NOT NULL,
    appearance text DEFAULT '{}' NOT NULL,
    ai text DEFAULT '{}' NOT NULL,
    seo text DEFAULT '{}' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  );`);
  await client.execute(
    `CREATE INDEX free_tools_blog_idx ON free_tools (blog_id);`,
  );
  await client.execute(
    `CREATE UNIQUE INDEX free_tools_blog_slug_idx ON free_tools (blog_id, slug);`,
  );
  return drizzle(client, { schema }) as unknown as TestDb;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function freeTool(overrides: Partial<FreeTool> = {}): FreeTool {
  return {
    id: "word-counter",
    blogId: "default",
    templateId: "word-counter",
    source: "predefined",
    enabled: true,
    slug: "word-counter",
    title: "Word Counter",
    metaTitle: "Word Counter",
    metaDescription: "Count words.",
    intro: "Count words.",
    faq: [],
    cta: { label: "Try BlogBat", url: "https://blogbat.com/" },
    callout: {
      enabled: true,
      heading: "Try BlogBat",
      body: "Build with BlogBat.",
      primaryLabel: "Try BlogBat",
      primaryUrl: "https://blogbat.com/",
      secondaryLabel: "Learn more",
      secondaryUrl: "https://blogbat.com/",
      utm: {
        source: "solo_blog",
        medium: "free_tool",
        campaign: "{{toolSlug}}",
        content: "bottom_callout",
        term: "",
      },
    },
    appearance: { layout: "utility", accent: "default" },
    ai: {
      enabled: false,
      provider: "claude",
      model: "claude-sonnet-4-6",
      dailyLimit: 10,
      maxInputChars: 12000,
      maxOutputTokens: 1200,
    },
    seo: {
      indexable: true,
      canonicalPath: "/tools/word-counter",
      includeInToolsIndex: true,
      includeInSitemap: true,
    },
    createdAt: "2026-04-25T00:00:00.000Z",
    updatedAt: "2026-04-25T00:00:00.000Z",
    ...overrides,
  };
}

async function insertTool(db: TestDb, tool: FreeTool): Promise<void> {
  await (db as unknown as ReturnType<typeof drizzle>)
    .insert(freeToolsTable)
    .values({
      id: tool.id,
      blogId: tool.blogId,
      templateId: tool.templateId,
      source: tool.source,
      enabled: tool.enabled,
      slug: tool.slug,
      title: tool.title,
      metaTitle: tool.metaTitle,
      metaDescription: tool.metaDescription,
      intro: tool.intro,
      faq: JSON.stringify(tool.faq),
      cta: JSON.stringify(tool.cta),
      callout: JSON.stringify(tool.callout),
      appearance: JSON.stringify(tool.appearance),
      ai: JSON.stringify(tool.ai),
      seo: JSON.stringify(tool.seo),
      createdAt: new Date(tool.createdAt).getTime(),
      updatedAt: new Date(tool.updatedAt).getTime(),
    });
}

// ---------------------------------------------------------------------------
// Mock defaults (for seedDefaultFreeTools tests)
// ---------------------------------------------------------------------------

vi.mock("./defaults", () => ({
  buildDefaultFreeTools: vi.fn(() => [
    freeTool({
      id: "word-counter",
      slug: "word-counter",
      title: "Word Counter",
    }),
    freeTool({
      id: "blog-outline-generator",
      slug: "blog-outline-generator",
      title: "Blog Outline Generator",
    }),
  ]),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("free tool repository", () => {
  let db: TestDb;

  beforeEach(async () => {
    db = await makeDb();
  });

  // -------------------------------------------------------------------------
  // isSafeFreeToolSlug
  // -------------------------------------------------------------------------

  it("accepts plain lowercase slug segments and rejects unsafe values", () => {
    expect(isSafeFreeToolSlug("linkedin-post-generator")).toBe(true);
    expect(isSafeFreeToolSlug("a")).toBe(true);
    expect(isSafeFreeToolSlug("")).toBe(false);
    expect(isSafeFreeToolSlug("../admin")).toBe(false);
    expect(isSafeFreeToolSlug("tools/foo")).toBe(false);
    expect(isSafeFreeToolSlug("api")).toBe(false);
    expect(isSafeFreeToolSlug("settings")).toBe(false);
    expect(isSafeFreeToolSlug(".")).toBe(false);
    expect(isSafeFreeToolSlug("..")).toBe(false);
    expect(isSafeFreeToolSlug("LinkedIn")).toBe(false);
    expect(isSafeFreeToolSlug("linked in")).toBe(false);
    expect(isSafeFreeToolSlug("linkedin_post")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // listFreeTools
  // -------------------------------------------------------------------------

  it("returns empty list when no tools exist", async () => {
    await expect(listFreeTools("default", db)).resolves.toEqual([]);
  });

  it("lists default-blog free tools sorted by title then id", async () => {
    await insertTool(db, freeTool({ id: "word-counter", title: "Word Counter", slug: "word-counter" }));
    await insertTool(db, freeTool({
      id: "blog-outline-generator",
      slug: "blog-outline-generator",
      title: "Blog Outline Generator",
    }));

    const tools = await listFreeTools("default", db);
    expect(tools).toHaveLength(2);
    expect(tools[0].title).toBe("Blog Outline Generator");
    expect(tools[1].title).toBe("Word Counter");
  });

  it("returns full FreeTool shape with parsed JSON fields", async () => {
    await insertTool(db, freeTool());

    const results = await listFreeTools("default", db);
    expect(results[0]).toMatchObject({
      id: "word-counter",
      blogId: "default",
      templateId: "word-counter",
      enabled: true,
      callout: expect.objectContaining({ heading: "Try BlogBat" }),
      seo: expect.objectContaining({ indexable: true }),
    });
  });

  // -------------------------------------------------------------------------
  // listEnabledPublicFreeTools
  // -------------------------------------------------------------------------

  it("lists only enabled + indexable + known-template tools", async () => {
    await insertTool(db, freeTool({ id: "word-counter", slug: "word-counter", title: "Word Counter" }));
    await insertTool(db, freeTool({
      id: "disabled",
      slug: "disabled-tool",
      title: "Disabled",
      enabled: false,
    }));

    const tools = await listEnabledPublicFreeTools({}, "default", db);
    expect(tools).toHaveLength(1);
    expect(tools[0].id).toBe("word-counter");
  });

  it("filters by includeInSitemap when surface is 'sitemap'", async () => {
    await insertTool(db, freeTool({
      seo: {
        indexable: true,
        canonicalPath: "/tools/word-counter",
        includeInToolsIndex: true,
        includeInSitemap: false,
      },
    }));

    const sitemap = await listEnabledPublicFreeTools({ surface: "sitemap" }, "default", db);
    expect(sitemap).toHaveLength(0);

    const index = await listEnabledPublicFreeTools({ surface: "index" }, "default", db);
    expect(index).toHaveLength(1);
  });

  it("lists enabled indexable public tools for the tools index", async () => {
    await insertTool(db, freeTool());

    const tools = await listEnabledPublicFreeTools({}, "default", db);
    expect(tools).toHaveLength(1);
    expect(tools[0].id).toBe("word-counter");
  });

  // -------------------------------------------------------------------------
  // hasEnabledPublicFreeTools
  // -------------------------------------------------------------------------

  it("returns false when no enabled tools exist", async () => {
    await expect(hasEnabledPublicFreeTools("default", db)).resolves.toBe(false);
  });

  it("returns true when at least one enabled tool exists", async () => {
    await insertTool(db, freeTool());
    await expect(hasEnabledPublicFreeTools("default", db)).resolves.toBe(true);
  });

  // -------------------------------------------------------------------------
  // resolvePublicFreeToolBySlug
  // -------------------------------------------------------------------------

  it("resolves only enabled public default-blog tools with known templates", async () => {
    await insertTool(db, freeTool({ id: "word-counter", templateId: "word-counter" }));
    const tool = await resolvePublicFreeToolBySlug("word-counter", "default", db);
    expect(tool).toMatchObject({ id: "word-counter", slug: "word-counter" });
  });

  it("returns null for a tool with an unknown template", async () => {
    await insertTool(db, freeTool({ templateId: "missing-template" }));
    await expect(resolvePublicFreeToolBySlug("word-counter", "default", db)).resolves.toBeNull();
  });

  it("returns null for unknown slug", async () => {
    await expect(resolvePublicFreeToolBySlug("no-such-tool", "default", db)).resolves.toBeNull();
  });

  it("returns null for disabled tool", async () => {
    await insertTool(db, freeTool({ enabled: false }));
    await expect(resolvePublicFreeToolBySlug("word-counter", "default", db)).resolves.toBeNull();
  });

  it("returns null for unsafe slugs", async () => {
    await expect(resolvePublicFreeToolBySlug("tools/word-counter", "default", db)).resolves.toBeNull();
    await expect(resolvePublicFreeToolBySlug("api", "default", db)).resolves.toBeNull();
  });

  // -------------------------------------------------------------------------
  // getFreeToolById
  // -------------------------------------------------------------------------

  it("returns the tool by id scoped to blog", async () => {
    await insertTool(db, freeTool());
    const tool = await getFreeToolById("word-counter", "default", db);
    expect(tool).not.toBeNull();
    expect(tool!.id).toBe("word-counter");
  });

  it("returns null when id not found", async () => {
    await expect(getFreeToolById("ghost", "default", db)).resolves.toBeNull();
  });

  // -------------------------------------------------------------------------
  // hasDuplicateFreeToolSlug
  // -------------------------------------------------------------------------

  it("checks duplicate slugs while excluding the current tool id", async () => {
    await insertTool(db, freeTool());
    await expect(hasDuplicateFreeToolSlug("word-counter", undefined, "default", db)).resolves.toBe(true);
    await expect(hasDuplicateFreeToolSlug("word-counter", "word-counter", "default", db)).resolves.toBe(false);
  });

  it("returns false for safe slug not yet used", async () => {
    await expect(hasDuplicateFreeToolSlug("new-tool", undefined, "default", db)).resolves.toBe(false);
  });

  it("returns false for unsafe slugs", async () => {
    await expect(hasDuplicateFreeToolSlug("api", undefined, "default", db)).resolves.toBe(false);
    await expect(hasDuplicateFreeToolSlug("tools/x", undefined, "default", db)).resolves.toBe(false);
  });

  // -------------------------------------------------------------------------
  // patchFreeTool
  // -------------------------------------------------------------------------

  it("patches one tool with updatedAt and rejects unsafe slug patches", async () => {
    await insertTool(db, freeTool());
    const before = Date.now();

    await patchFreeTool("word-counter", { title: "Updated Word Counter" }, "default", db);

    const result = await getFreeToolById("word-counter", "default", db);
    expect(result!.title).toBe("Updated Word Counter");
    expect(new Date(result!.updatedAt).getTime()).toBeGreaterThanOrEqual(before);

    await expect(
      patchFreeTool("word-counter", { slug: "tools/word-counter" }, "default", db),
    ).rejects.toThrow("Unsafe free tool slug");
  });

  it("merges nested patch maps with existing tool configuration", async () => {
    await insertTool(db, freeTool({
      ai: {
        enabled: false,
        provider: "claude",
        model: "claude-sonnet-4-6",
        dailyLimit: 10,
        maxInputChars: 12000,
        maxOutputTokens: 1200,
      },
    }));

    await patchFreeTool("word-counter", { ai: { enabled: true } }, "default", db);

    const result = await getFreeToolById("word-counter", "default", db);
    expect(result!.ai).toEqual({
      enabled: true,
      provider: "claude",
      model: "claude-sonnet-4-6",
      dailyLimit: 10,
      maxInputChars: 12000,
      maxOutputTokens: 1200,
    });
  });

  it("rejects duplicate slug patches before writing", async () => {
    await insertTool(db, freeTool({ id: "word-counter", slug: "word-counter" }));
    await insertTool(db, freeTool({ id: "blog-outline-generator", slug: "blog-outline-generator" }));

    await expect(
      patchFreeTool("word-counter", { slug: "blog-outline-generator" }, "default", db),
    ).rejects.toThrow("Free tool slug already exists");
  });

  it("allows patching a tool to its own existing slug", async () => {
    await insertTool(db, freeTool());
    await expect(
      patchFreeTool("word-counter", { slug: "word-counter" }, "default", db),
    ).resolves.toBeUndefined();
  });

  it("merges nested callout patch preserving utm fields", async () => {
    await insertTool(db, freeTool());

    await patchFreeTool("word-counter", {
      callout: { heading: "New Heading" },
    }, "default", db);

    const result = await getFreeToolById("word-counter", "default", db);
    expect(result!.callout.heading).toBe("New Heading");
    expect(result!.callout.primaryUrl).toBe("https://blogbat.com/");
    expect(result!.callout.utm.source).toBe("solo_blog");
  });

  // -------------------------------------------------------------------------
  // seedDefaultFreeTools
  // -------------------------------------------------------------------------

  it("seeds missing defaults without overwriting existing customized tools", async () => {
    await insertTool(db, freeTool({ title: "Custom Word Counter" }));

    const result = await seedDefaultFreeTools(
      { enabled: true, aiEnabled: false },
      "default",
      db,
    );

    expect(result).toEqual({ created: 1, skipped: 1 });
    // Original should be unchanged
    const existing = await getFreeToolById("word-counter", "default", db);
    expect(existing!.title).toBe("Custom Word Counter");
  });

  it("seeds all tools when none exist", async () => {
    const result = await seedDefaultFreeTools(
      { enabled: true, aiEnabled: false },
      "default",
      db,
    );
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  it("blog A tools are invisible to blog B queries", async () => {
    await insertTool(db, freeTool({ blogId: "blog-a" as "default" }));

    const listB = await listFreeTools("blog-b", db);
    expect(listB).toHaveLength(0);

    const listA = await listFreeTools("blog-a", db);
    expect(listA).toHaveLength(1);
  });

  it("resolvePublicFreeToolBySlug does not cross blog boundaries", async () => {
    await insertTool(db, freeTool({ blogId: "blog-a" as "default" }));

    await expect(resolvePublicFreeToolBySlug("word-counter", "blog-b", db)).resolves.toBeNull();
    await expect(resolvePublicFreeToolBySlug("word-counter", "blog-a", db)).resolves.not.toBeNull();
  });

  it("patchFreeTool scopes update to the matching blog", async () => {
    await insertTool(db, freeTool({ blogId: "blog-a" as "default", id: "tool-a" }));
    await insertTool(db, freeTool({ blogId: "blog-b" as "default", id: "tool-b" }));

    await patchFreeTool("tool-a", { title: "Blog-A Updated" }, "blog-a", db);

    const toolA = await getFreeToolById("tool-a", "blog-a", db);
    const toolB = await getFreeToolById("tool-b", "blog-b", db);
    expect(toolA!.title).toBe("Blog-A Updated");
    expect(toolB!.title).toBe("Word Counter");
  });

  it("hasEnabledPublicFreeTools is scoped to blog", async () => {
    await insertTool(db, freeTool({ blogId: "blog-a" as "default" }));

    await expect(hasEnabledPublicFreeTools("blog-b", db)).resolves.toBe(false);
    await expect(hasEnabledPublicFreeTools("blog-a", db)).resolves.toBe(true);
  });

  it("slug uniqueness is per-blog: same slug is allowed in different blogs", async () => {
    await insertTool(db, freeTool({ blogId: "blog-a" as "default", id: "tool-a" }));
    // Same slug in a different blog is fine
    await expect(
      insertTool(db, freeTool({ blogId: "blog-b" as "default", id: "tool-b" })),
    ).resolves.toBeUndefined();

    // Duplicate check is also per-blog
    await expect(hasDuplicateFreeToolSlug("word-counter", undefined, "blog-b", db)).resolves.toBe(true);
    await expect(hasDuplicateFreeToolSlug("word-counter", "tool-b", "blog-b", db)).resolves.toBe(false);
  });
});
