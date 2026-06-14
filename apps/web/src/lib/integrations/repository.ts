import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { integrations } from "@/db/schema/integrations";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:integrations");

type DB = DrizzleD1Database<typeof schema>;
type Row = typeof integrations.$inferSelect;

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface IntegrationRow {
  id: string;
  blogId: string;
  name: string;
  type: string;
  status: string;
  description: string;
  icon: string;
  config: Record<string, unknown>;
  connectedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

function toRow(row: Row): IntegrationRow {
  return {
    id: row.id,
    blogId: row.blogId,
    name: row.name,
    type: row.type,
    status: row.status,
    description: row.description,
    icon: row.icon,
    config: JSON.parse(row.config) as Record<string, unknown>,
    connectedAt: row.connectedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listIntegrations(
  blogId: string,
  db: DB = getDb(),
): Promise<IntegrationRow[]> {
  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.blogId, blogId))
    // id tiebreaker for deterministic ordering on same-ms rows
    .orderBy(desc(integrations.createdAt), desc(integrations.id));

  return rows.map(toRow);
}

// ---------------------------------------------------------------------------
// Get single
// ---------------------------------------------------------------------------

export async function getIntegration(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<IntegrationRow | null> {
  const rows = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.blogId, blogId), eq(integrations.id, id)))
    .limit(1);

  return rows.length > 0 ? toRow(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export type CreateIntegrationInput = {
  name: string;
  type: string;
  status: string;
  description: string;
  icon: string;
  config: Record<string, unknown>;
  connectedAt: number | null;
};

export async function createIntegration(
  blogId: string,
  input: CreateIntegrationInput,
  db: DB = getDb(),
): Promise<IntegrationRow> {
  return createIntegrationWithId(blogId, nanoid(), input, db);
}

/**
 * Create an integration with an explicit pre-allocated id.
 * Used when the id must be known before insertion (e.g. webhook endpoint path
 * embeds the integration id and must be computed before writing to D1).
 */
export async function createIntegrationWithId(
  blogId: string,
  id: string,
  input: CreateIntegrationInput,
  db: DB = getDb(),
): Promise<IntegrationRow> {
  const now = Date.now();

  await db.insert(integrations).values({
    id,
    blogId,
    name: input.name,
    type: input.type,
    status: input.status,
    description: input.description,
    icon: input.icon,
    config: JSON.stringify(input.config),
    connectedAt: input.connectedAt,
    createdAt: now,
    updatedAt: now,
  });

  log.info("Created integration", { id, blogId, type: input.type });

  return {
    id,
    blogId,
    name: input.name,
    type: input.type,
    status: input.status,
    description: input.description,
    icon: input.icon,
    config: input.config,
    connectedAt: input.connectedAt,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export type UpdateIntegrationInput = {
  name?: string;
  status?: string;
  description?: string;
  config?: Record<string, unknown>;
  connectedAt?: number | null;
};

/**
 * Update scalar fields + optionally replace the config JSON.
 *
 * Config replacement semantics: when `patch.config` is supplied, it REPLACES
 * the full stored config object (not a deep merge). Callers that need deep merge
 * (e.g. webhook config patch) must do so before calling this function —
 * see `mergeWebhookIntegrationConfigPatch` in webhook-integration.ts.
 *
 * Returns the updated row, or null if not found / not owned by blogId.
 */
export async function updateIntegration(
  blogId: string,
  id: string,
  patch: UpdateIntegrationInput,
  db: DB = getDb(),
): Promise<IntegrationRow | null> {
  const now = Date.now();

  const updates: Partial<typeof integrations.$inferInsert> = {
    updatedAt: now,
  };

  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.config !== undefined) updates.config = JSON.stringify(patch.config);
  if ("connectedAt" in patch) updates.connectedAt = patch.connectedAt;

  await db
    .update(integrations)
    .set(updates)
    .where(and(eq(integrations.blogId, blogId), eq(integrations.id, id)));

  return getIntegration(blogId, id, db);
}

// ---------------------------------------------------------------------------
// Bulk delete
// ---------------------------------------------------------------------------

export async function deleteIntegrations(
  blogId: string,
  ids: string[],
  db: DB = getDb(),
): Promise<number> {
  if (ids.length === 0) return 0;

  const rows = await db
    .delete(integrations)
    .where(
      and(eq(integrations.blogId, blogId), inArray(integrations.id, ids)),
    )
    .returning({ id: integrations.id });

  log.info("Deleted integrations", { count: rows.length, blogId });

  return rows.length;
}

// ---------------------------------------------------------------------------
// Single delete
// ---------------------------------------------------------------------------

export async function deleteIntegration(
  blogId: string,
  id: string,
  db: DB = getDb(),
): Promise<boolean> {
  const rows = await db
    .delete(integrations)
    .where(and(eq(integrations.blogId, blogId), eq(integrations.id, id)))
    .returning({ id: integrations.id });

  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Provider-scoped helpers (for google-sync-config)
// ---------------------------------------------------------------------------

/**
 * List all connected integrations of a given type filtered by status.
 * Used by google-sync-config to find the active Google OAuth integration.
 */
export async function listIntegrationsByTypeAndStatus(
  blogId: string,
  type: string,
  status: string,
  db: DB = getDb(),
): Promise<IntegrationRow[]> {
  const rows = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.blogId, blogId),
        eq(integrations.type, type),
        eq(integrations.status, status),
      ),
    )
    .orderBy(desc(integrations.createdAt), desc(integrations.id));

  return rows.map(toRow);
}
