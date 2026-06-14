import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { contentPlans } from "@/db/schema/content-plans";
import { createLogger } from "@/lib/logger";
import type { ContentPlanPost } from "@repo/types";

const log = createLogger("lib:content-plans");

type DB = DrizzleD1Database<typeof schema>;

// ---------------------------------------------------------------------------
// Row → public shape
// ---------------------------------------------------------------------------

type Row = typeof contentPlans.$inferSelect;

export interface ContentPlanEntry {
  id: string;
  blogId: string;
  name: string;
  status: string;
  posts: ContentPlanPost[];
  provider: string;
  createdAt: number;
  updatedAt: number;
}

function toEntry(row: Row): ContentPlanEntry {
  return {
    id: row.id,
    blogId: row.blogId,
    name: row.name,
    status: row.status,
    posts: JSON.parse(row.posts) as ContentPlanPost[],
    provider: row.provider,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listContentPlans(
  blogId: string,
  { limit = 50 }: { limit?: number } = {},
  db: DB = getDb(),
): Promise<ContentPlanEntry[]> {
  const rows = await db
    .select()
    .from(contentPlans)
    .where(eq(contentPlans.blogId, blogId))
    .orderBy(desc(contentPlans.createdAt), desc(contentPlans.id))
    .limit(limit);
  return rows.map(toEntry);
}

export async function getContentPlan(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<ContentPlanEntry | null> {
  const [row] = await db
    .select()
    .from(contentPlans)
    .where(and(eq(contentPlans.blogId, blogId), eq(contentPlans.id, id)));
  return row ? toEntry(row) : null;
}

export type CreateContentPlanInput = {
  name: string;
  status?: string;
  posts: ContentPlanPost[];
  provider?: string;
};

export async function createContentPlan(
  blogId: string,
  input: CreateContentPlanInput,
  db: DB = getDb(),
): Promise<ContentPlanEntry> {
  const id = nanoid();
  const now = Date.now();
  const status = input.status ?? "active";
  const provider = input.provider ?? "claude";

  await db.insert(contentPlans).values({
    id,
    blogId,
    name: input.name,
    status,
    posts: JSON.stringify(input.posts),
    provider,
    createdAt: now,
    updatedAt: now,
  });

  log.info("Created content plan", { id, blogId });

  return {
    id,
    blogId,
    name: input.name,
    status,
    posts: input.posts,
    provider,
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteContentPlan(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(contentPlans)
    .where(and(eq(contentPlans.blogId, blogId), eq(contentPlans.id, id)))
    .returning({ id: contentPlans.id });
  return rows.length > 0;
}
