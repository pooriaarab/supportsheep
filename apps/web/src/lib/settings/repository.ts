import "server-only";

import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { blogSettings } from "@/db/schema/config";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";

type DB = DrizzleD1Database<typeof schema>;

/** Shape of the application settings document (mirrors the previous Firestore model). */
export interface BlogSettingsData {
  appName?: string;
  description?: string;
  theme?: string;
  notifications?: { email?: boolean; push?: boolean };
  security?: {
    allowedDomains?: string[];
    mfaRequired?: boolean;
    sessionTimeoutMinutes?: number;
  };
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

const DEFAULT_BLOG_SETTINGS: BlogSettingsData = {
  appName: "My App",
  description: "",
  theme: "system",
  notifications: { email: true, push: false },
};

/**
 * Return the stored settings for a blog, merged with defaults.
 */
export async function getBlogSettings(
  blogId: string = DEFAULT_blog_id,
  db: DB = getDb(),
): Promise<BlogSettingsData> {
  const rows = await db
    .select()
    .from(blogSettings)
    .where(eq(blogSettings.blogId, blogId))
    .limit(1);
  if (rows.length > 0) {
    const stored = JSON.parse(rows[0].data) as BlogSettingsData;
    return deepMerge(DEFAULT_BLOG_SETTINGS, stored) as BlogSettingsData;
  }
  return DEFAULT_BLOG_SETTINGS;
}

/**
 * Deep-merge a partial settings patch into the existing stored settings and persist.
 * Returns the fully merged result.
 */
export async function updateBlogSettings(
  blogId: string,
  patch: Partial<BlogSettingsData>,
  db: DB = getDb(),
): Promise<BlogSettingsData> {
  // Read current stored data (without defaults so we store only overrides).
  const rows = await db
    .select()
    .from(blogSettings)
    .where(eq(blogSettings.blogId, blogId))
    .limit(1);

  const existing: BlogSettingsData =
    rows.length > 0 ? (JSON.parse(rows[0].data) as BlogSettingsData) : {};

  const merged = deepMerge(existing, patch) as BlogSettingsData;

  await db
    .insert(blogSettings)
    .values({
      blogId,
      data: JSON.stringify(merged),
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: blogSettings.blogId,
      set: {
        data: JSON.stringify(merged),
        updatedAt: Date.now(),
      },
    });

  // Return the result with defaults applied (what the GET would return).
  return deepMerge(DEFAULT_BLOG_SETTINGS, merged) as BlogSettingsData;
}

/** Recursively merge src into target (non-mutating, produces a new object). */
function deepMerge(
  target: Record<string, unknown>,
  src: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const [k, v] of Object.entries(src)) {
    if (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      typeof result[k] === "object" &&
      result[k] !== null &&
      !Array.isArray(result[k])
    ) {
      result[k] = deepMerge(
        result[k] as Record<string, unknown>,
        v as Record<string, unknown>,
      );
    } else if (v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}
