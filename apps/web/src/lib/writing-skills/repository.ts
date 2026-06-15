import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { writingSkills } from "@/db/schema/writing-skills";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:writing-skills");

type DB = DrizzleD1Database<typeof schema>;

/** API entry shape — mirrors the WritingSkill type from @repo/types. */
export interface WritingSkillEntry {
  id: string;
  blogId: string;
  name: string;
  type: string;
  description: string;
  prompt: string;
  provider: string;
  model: string;
  order: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

type Row = typeof writingSkills.$inferSelect;

function toEntry(row: Row): WritingSkillEntry {
  return {
    id: row.id,
    blogId: row.blogId,
    name: row.name,
    type: row.type,
    description: row.description,
    prompt: row.prompt,
    provider: row.provider,
    model: row.model,
    order: row.order,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// BUILTIN catalog — moved here from lib/generation/seed-skills.ts
// ---------------------------------------------------------------------------

export const BUILTIN_SKILLS = [
  {
    name: "Humanizer",
    description:
      "Rewrites content to reduce AI-sounding patterns and make it feel natural.",
    prompt:
      "Rewrite to reduce AI-sounding patterns. Vary sentence structure and length. Use natural transitions. Avoid formulaic phrases like 'In today\\'s world', 'It\\'s worth noting', 'Let\\'s dive in'. Keep the same meaning and factual content.",
    provider: "claude",
    model: "",
    order: 0,
  },
  {
    name: "Brand Voice",
    description:
      "Applies consistent brand voice with active, direct, confident tone.",
    prompt:
      "Apply consistent brand voice. Use active voice. Be direct and confident. Avoid jargon unless the audience expects it. Keep the same structure and facts.",
    provider: "claude",
    model: "",
    order: 1,
  },
  {
    name: "SEO Optimizer",
    description:
      "Optimizes content for search engines with keyword placement and heading structure.",
    prompt:
      "Optimize for search engines. Ensure the target keyword appears in the first 100 words, in at least one H2, and 2-3 times naturally throughout. Add transition words. Improve heading hierarchy. Do not change the topic or meaning.",
    provider: "claude",
    model: "",
    order: 2,
  },
  {
    name: "Readability",
    description:
      "Simplifies complex sentences and improves readability to 8th grade level.",
    prompt:
      "Simplify complex sentences. Break long paragraphs. Use shorter words where possible. Target 8th grade reading level. Preserve all facts and meaning.",
    provider: "claude",
    model: "",
    order: 3,
  },
  {
    name: "Fact Checker",
    description:
      "Reviews content for factual claims and flags unverifiable statements.",
    prompt:
      "Review for factual claims. Add [VERIFY: ...] notes next to unverifiable statistics or claims. Do not change verified facts. Return the content with verification notes inline.",
    provider: "claude",
    model: "",
    order: 4,
  },
] as const;

// ---------------------------------------------------------------------------
// Seed — idempotent, non-fatal
// ---------------------------------------------------------------------------

/**
 * Seed the 5 builtin writing skills for `blogId` when the knowledge base has none.
 * Idempotent (no-op if any skills already exist). Swallows errors so it
 * never breaks a list request.
 */
export async function seedBuiltinSkills(
  blogId: string,
  db: DB = getDb(),
): Promise<void> {
  try {
    const existing = await db
      .select({ id: writingSkills.id })
      .from(writingSkills)
      .where(eq(writingSkills.blogId, blogId))
      .limit(1);
    if (existing.length > 0) return;

    log.info("Seeding builtin writing skills", { blogId });

    const stmts = BUILTIN_SKILLS.map((skill) =>
      db.insert(writingSkills).values({
        id: nanoid(),
        blogId,
        name: skill.name,
        type: "builtin",
        description: skill.description,
        prompt: skill.prompt,
        provider: skill.provider,
        model: skill.model,
        order: skill.order,
        enabled: true,
      }),
    );

    // Use batch for atomicity — all 5 rows or none.
    await db.batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]]);

    log.info("Seeded builtin writing skills", {
      blogId,
      count: BUILTIN_SKILLS.length,
    });
  } catch (err) {
    // Swallow — must never break a list request — but log for observability.
    log.error("Failed to seed builtin writing skills", {
      blogId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listWritingSkills(
  blogId: string,
  db: DB = getDb(),
): Promise<WritingSkillEntry[]> {
  const rows = await db
    .select()
    .from(writingSkills)
    .where(eq(writingSkills.blogId, blogId))
    .orderBy(asc(writingSkills.order));
  return rows.map(toEntry);
}

export type CreateWritingSkillInput = {
  name: string;
  description?: string;
  prompt: string;
  provider?: string;
  model?: string;
  enabled?: boolean;
};

export async function createWritingSkill(
  blogId: string,
  input: CreateWritingSkillInput,
  db: DB = getDb(),
): Promise<WritingSkillEntry> {
  const maxRow = await db
    .select({ max: sql<number>`coalesce(max(${writingSkills.order}), -1)` })
    .from(writingSkills)
    .where(eq(writingSkills.blogId, blogId));
  const nextOrder = (maxRow[0]?.max ?? -1) + 1;

  const [row] = await db
    .insert(writingSkills)
    .values({
      id: nanoid(),
      blogId,
      name: input.name,
      type: "custom",
      description: input.description ?? "",
      prompt: input.prompt,
      provider: input.provider ?? "claude",
      model: input.model ?? "",
      order: nextOrder,
      enabled: input.enabled ?? true,
    })
    .returning();
  return toEntry(row);
}

export async function getWritingSkill(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<WritingSkillEntry | null> {
  const rows = await db
    .select()
    .from(writingSkills)
    .where(and(eq(writingSkills.blogId, blogId), eq(writingSkills.id, id)))
    .limit(1);
  return rows[0] ? toEntry(rows[0]) : null;
}

export type UpdateWritingSkillInput = {
  name?: string;
  description?: string;
  prompt?: string;
  provider?: string;
  model?: string;
  enabled?: boolean;
};

/**
 * Returns the updated entry, or null if no skill with that id exists for the knowledge base.
 */
export async function updateWritingSkill(
  blogId: string,
  id: string,
  patch: UpdateWritingSkillInput,
  db: DB = getDb(),
): Promise<WritingSkillEntry | null> {
  const updates: Partial<Row> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.prompt !== undefined) updates.prompt = patch.prompt;
  if (patch.provider !== undefined) updates.provider = patch.provider;
  if (patch.model !== undefined) updates.model = patch.model;
  if (patch.enabled !== undefined) updates.enabled = patch.enabled;

  const [row] = await db
    .update(writingSkills)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(and(eq(writingSkills.blogId, blogId), eq(writingSkills.id, id)))
    .returning();
  return row ? toEntry(row) : null;
}

export async function deleteWritingSkill(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(writingSkills)
    .where(and(eq(writingSkills.blogId, blogId), eq(writingSkills.id, id)))
    .returning({ id: writingSkills.id });
  return rows.length > 0;
}

export async function reorderWritingSkills(
  blogId: string,
  order: Record<string, number>,
  db: DB = getDb(),
): Promise<number> {
  const entries = Object.entries(order);
  if (entries.length === 0) return 0;
  // Atomic batch — single round-trip on D1 so a partial failure can't leave
  // skills half-reordered.
  const stmts = entries.map(([id, value]) =>
    db
      .update(writingSkills)
      .set({ order: value, updatedAt: new Date().toISOString() })
      .where(and(eq(writingSkills.blogId, blogId), eq(writingSkills.id, id))),
  );
  await db.batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]]);
  return entries.length;
}
