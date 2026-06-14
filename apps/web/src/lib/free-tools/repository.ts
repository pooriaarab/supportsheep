import "server-only";

import type { FreeTool } from "@repo/types";
import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { freeTools as freeToolsTable } from "@/db/schema/free-tools";
import { createLogger } from "@/lib/logger";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

import { buildDefaultFreeTools } from "./defaults";
import { getFreeToolTemplate } from "./templates";
import type { FreeToolAdminUpdateInput } from "./types";

const log = createLogger("lib:free-tools");

type DB = DrizzleD1Database<typeof schema>;

const RESERVED_FREE_TOOL_SLUGS = new Set([
  "api",
  "settings",
  "dashboard",
  "blog",
  "authors",
  "categories",
  "tools",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Row = typeof freeToolsTable.$inferSelect;

function rowToFreeTool(row: Row): FreeTool {
  return {
    id: row.id,
    blogId: row.blogId as "default",
    templateId: row.templateId,
    source: row.source as "predefined",
    enabled: row.enabled,
    slug: row.slug,
    title: row.title,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    intro: row.intro,
    faq: JSON.parse(row.faq) as FreeTool["faq"],
    cta: JSON.parse(row.cta) as FreeTool["cta"],
    callout: JSON.parse(row.callout) as FreeTool["callout"],
    appearance: JSON.parse(row.appearance) as FreeTool["appearance"],
    ai: JSON.parse(row.ai) as FreeTool["ai"],
    seo: JSON.parse(row.seo) as FreeTool["seo"],
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function mergePatch(
  existing: FreeTool | undefined,
  patch: FreeToolAdminUpdateInput,
): FreeToolAdminUpdateInput {
  const merged: FreeToolAdminUpdateInput = { ...patch };

  if (patch.appearance) {
    merged.appearance = existing
      ? { ...existing.appearance, ...patch.appearance }
      : patch.appearance;
  }
  if (patch.ai) {
    merged.ai = existing ? { ...existing.ai, ...patch.ai } : patch.ai;
  }
  if (patch.seo) {
    merged.seo = existing ? { ...existing.seo, ...patch.seo } : patch.seo;
  }
  if (patch.callout) {
    merged.callout = existing
      ? {
          ...existing.callout,
          ...patch.callout,
          utm: {
            ...existing.callout.utm,
            ...patch.callout.utm,
          },
        }
      : patch.callout;
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class DuplicateFreeToolSlugError extends Error {
  constructor(slug: string) {
    super(`Free tool slug already exists: ${slug}`);
    this.name = "DuplicateFreeToolSlugError";
  }
}

// ---------------------------------------------------------------------------
// Exported helpers
// ---------------------------------------------------------------------------

export function isSafeFreeToolSlug(slug: string): boolean {
  if (!slug || RESERVED_FREE_TOOL_SLUGS.has(slug)) {
    return false;
  }
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

export async function listFreeTools(
  blogId: string = DEFAULT_BLOG_ID,
  db: DB = getDb(),
): Promise<FreeTool[]> {
  const rows = await db
    .select()
    .from(freeToolsTable)
    .where(eq(freeToolsTable.blogId, blogId))
    .orderBy(asc(freeToolsTable.title), asc(freeToolsTable.id));

  return rows.map(rowToFreeTool);
}

/**
 * Public-render read fns resolve `getDb()` INSIDE the try/catch so that a
 * fully-static prerender (no Cloudflare binding → `getCloudflareContext()`
 * throws) degrades gracefully instead of failing the build. Mirrors the
 * `getBlogConfig` pattern. Authed/admin fns keep `db: DB = getDb()` since they
 * only run in dynamic routes with a live Cloudflare context.
 */
export async function listEnabledPublicFreeTools(
  options: { surface?: "index" | "sitemap" } = {},
  blogId: string = DEFAULT_BLOG_ID,
  db?: DB,
): Promise<FreeTool[]> {
  const includeSeoField =
    options.surface === "sitemap" ? "includeInSitemap" : "includeInToolsIndex";

  let rows: Row[];
  try {
    const database = db ?? getDb();
    rows = await database
      .select()
      .from(freeToolsTable)
      .where(
        and(
          eq(freeToolsTable.blogId, blogId),
          eq(freeToolsTable.enabled, true),
        ),
      )
      .orderBy(asc(freeToolsTable.title), asc(freeToolsTable.id));
  } catch {
    // Build-time static prerender / no Cloudflare context → no free tools.
    return [];
  }

  return rows.flatMap((row) => {
    const tool = rowToFreeTool(row);
    return tool.seo.indexable &&
      Boolean(tool.seo[includeSeoField]) &&
      Boolean(getFreeToolTemplate(tool.templateId))
      ? [tool]
      : [];
  });
}

export async function hasEnabledPublicFreeTools(
  blogId: string = DEFAULT_BLOG_ID,
  db?: DB,
): Promise<boolean> {
  const tools = await listEnabledPublicFreeTools({}, blogId, db);
  return tools.length > 0;
}

export async function resolvePublicFreeToolBySlug(
  slug: string,
  blogId: string = DEFAULT_BLOG_ID,
  db?: DB,
): Promise<FreeTool | null> {
  if (!isSafeFreeToolSlug(slug)) {
    return null;
  }

  let rows: Row[];
  try {
    const database = db ?? getDb();
    rows = await database
      .select()
      .from(freeToolsTable)
      .where(
        and(
          eq(freeToolsTable.blogId, blogId),
          eq(freeToolsTable.slug, slug),
          eq(freeToolsTable.enabled, true),
        ),
      )
      .limit(1);
  } catch {
    // Build-time static prerender / no Cloudflare context → not resolvable.
    return null;
  }

  if (rows.length === 0) return null;

  const tool = rowToFreeTool(rows[0]);
  if (!getFreeToolTemplate(tool.templateId)) {
    return null;
  }

  return tool;
}

export async function getFreeToolById(
  id: string,
  blogId: string = DEFAULT_BLOG_ID,
  db: DB = getDb(),
): Promise<FreeTool | null> {
  const rows = await db
    .select()
    .from(freeToolsTable)
    .where(
      and(eq(freeToolsTable.id, id), eq(freeToolsTable.blogId, blogId)),
    )
    .limit(1);

  return rows.length > 0 ? rowToFreeTool(rows[0]) : null;
}

export async function hasDuplicateFreeToolSlug(
  slug: string,
  currentId?: string,
  blogId: string = DEFAULT_BLOG_ID,
  db: DB = getDb(),
): Promise<boolean> {
  if (!isSafeFreeToolSlug(slug)) {
    return false;
  }

  const rows = await db
    .select({ id: freeToolsTable.id })
    .from(freeToolsTable)
    .where(
      and(eq(freeToolsTable.blogId, blogId), eq(freeToolsTable.slug, slug)),
    );

  return rows.some((row) => row.id !== currentId);
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

export async function patchFreeTool(
  id: string,
  patch: FreeToolAdminUpdateInput,
  blogId: string = DEFAULT_BLOG_ID,
  db: DB = getDb(),
): Promise<void> {
  if (patch.slug !== undefined && !isSafeFreeToolSlug(patch.slug)) {
    throw new Error("Unsafe free tool slug");
  }
  if (
    patch.slug !== undefined &&
    (await hasDuplicateFreeToolSlug(patch.slug, id, blogId, db))
  ) {
    throw new DuplicateFreeToolSlugError(patch.slug);
  }

  const existing = await getFreeToolById(id, blogId, db);
  const merged = mergePatch(existing ?? undefined, patch);
  const now = Date.now();

  const updates: Partial<typeof freeToolsTable.$inferInsert> = {
    updatedAt: now,
  };

  if (merged.slug !== undefined) updates.slug = merged.slug;
  if (merged.title !== undefined) updates.title = merged.title;
  if (merged.metaTitle !== undefined) updates.metaTitle = merged.metaTitle;
  if (merged.metaDescription !== undefined)
    updates.metaDescription = merged.metaDescription;
  if (merged.intro !== undefined) updates.intro = merged.intro;
  if (merged.enabled !== undefined) updates.enabled = merged.enabled;
  if (merged.faq !== undefined) updates.faq = JSON.stringify(merged.faq);
  if (merged.cta !== undefined) updates.cta = JSON.stringify(merged.cta);
  if (merged.callout !== undefined)
    updates.callout = JSON.stringify(merged.callout);
  if (merged.appearance !== undefined)
    updates.appearance = JSON.stringify(merged.appearance);
  if (merged.ai !== undefined) updates.ai = JSON.stringify(merged.ai);
  if (merged.seo !== undefined) updates.seo = JSON.stringify(merged.seo);

  await db
    .update(freeToolsTable)
    .set(updates)
    .where(
      and(eq(freeToolsTable.id, id), eq(freeToolsTable.blogId, blogId)),
    );

  log.info("Patched free tool", { id, blogId });
}

export async function seedDefaultFreeTools(
  options: { enabled: boolean; aiEnabled: boolean },
  blogId: string = DEFAULT_BLOG_ID,
  db: DB = getDb(),
): Promise<{ created: number; skipped: number }> {
  const defaults = buildDefaultFreeTools({ ...options, blogId: blogId as "default" });
  let created = 0;
  let skipped = 0;

  for (const tool of defaults) {
    const existing = await getFreeToolById(tool.id, blogId, db);
    if (existing) {
      skipped += 1;
      continue;
    }

    const now = Date.now();
    await db.insert(freeToolsTable).values({
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
      createdAt: now,
      updatedAt: now,
    });
    created += 1;
  }

  log.info("Seeded free tools", { created, skipped, blogId });

  return { created, skipped };
}
