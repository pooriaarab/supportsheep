import "server-only";

import { createHash, randomBytes } from "crypto";

import { and, desc, eq, inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { apiKeys } from "@/db/schema/api-keys";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:api-keys");

type DB = DrizzleD1Database<typeof schema>;

/** Entry shape returned by listApiKeys. */
export interface ApiKeyListEntry {
  id: string;
  name: string;
  keyPreview: string;
  scopes: string[];
  createdAt: number;
  lastUsed: number | null;
}

type Row = typeof apiKeys.$inferSelect;

function parseScopes(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toListEntry(row: Row): ApiKeyListEntry {
  return {
    id: row.id,
    name: row.name,
    keyPreview: row.keyPreview,
    scopes: parseScopes(row.scopes),
    createdAt: row.createdAt,
    lastUsed: row.lastUsed ?? null,
  };
}

/**
 * Generate a prefixed API key with a preview suffix.
 * full = "sk-" + 32-byte hex (64 chars); preview = "sk-..."+last4 of hex.
 * The full token is returned to the caller ONCE; only its SHA-256 hash is
 * persisted (`key_hash`), so a DB compromise does not yield usable tokens.
 */
function generateApiKey(): { full: string; preview: string } {
  const raw = randomBytes(32).toString("hex");
  const full = `sk-${raw}`;
  const preview = `sk-...${raw.slice(-4)}`;
  return { full, preview };
}

/** SHA-256 of a token, hex-encoded — what we store and look up by. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listApiKeys(
  ownerId: string,
  db: DB = getDb(),
): Promise<ApiKeyListEntry[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.ownerId, ownerId))
    // Tiebreaker on id keeps ordering deterministic for keys created in the
    // same millisecond (createdAt is ms-resolution).
    .orderBy(desc(apiKeys.createdAt), desc(apiKeys.id));
  return rows.map(toListEntry);
}

export type CreateApiKeyInput = {
  name: string;
  scopes: string[];
};

export type CreateApiKeyResult = {
  id: string;
  name: string;
  key: string;
  keyPreview: string;
  scopes: string[];
};

export async function createApiKey(
  ownerId: string,
  blogId: string,
  input: CreateApiKeyInput,
  db: DB = getDb(),
): Promise<CreateApiKeyResult> {
  const { full, preview } = generateApiKey();
  const id = nanoid();

  await db.insert(apiKeys).values({
    id,
    ownerId,
    blogId,
    name: input.name,
    keyPreview: preview,
    keyHash: hashToken(full),
    scopes: JSON.stringify(input.scopes),
    createdAt: Date.now(),
    lastUsed: null,
  });

  log.info("Created API key", { id, ownerId, blogId });

  return {
    id,
    name: input.name,
    key: full,
    keyPreview: preview,
    scopes: input.scopes,
  };
}

/**
 * Delete API keys by ids, scoped to ownerId.
 * Only rows where owner_id matches AND id is in the list are deleted.
 * Returns the number of rows actually deleted.
 */
export async function deleteApiKeys(
  ownerId: string,
  ids: string[],
  db: DB = getDb(),
): Promise<number> {
  if (ids.length === 0) return 0;

  const deleted = await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.ownerId, ownerId), inArray(apiKeys.id, ids)))
    .returning({ id: apiKeys.id });

  return deleted.length;
}

/**
 * Look up an API key by its token value (key_hash column).
 * Returns { id, ownerId, blogId, scopes } or null if not found.
 * blogId is the tenant the key is bound to — callers MUST scope all work to it.
 */
export async function findApiKeyByToken(
  token: string,
  db: DB = getDb(),
): Promise<{
  id: string;
  ownerId: string;
  blogId: string;
  scopes: string[];
} | null> {
  const rows = await db
    .select({
      id: apiKeys.id,
      ownerId: apiKeys.ownerId,
      blogId: apiKeys.blogId,
      scopes: apiKeys.scopes,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hashToken(token)))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id,
    ownerId: row.ownerId,
    blogId: row.blogId,
    scopes: parseScopes(row.scopes),
  };
}

/**
 * Record that an API key was just used (sets `last_used` to now).
 * Intended to be called fire-and-forget after a successful auth lookup —
 * this is telemetry and must never block or fail the auth path.
 * Returns the number of rows updated (1 if the id existed, else 0).
 */
export async function touchApiKeyLastUsed(
  id: string,
  db: DB = getDb(),
): Promise<number> {
  const updated = await db
    .update(apiKeys)
    .set({ lastUsed: Date.now() })
    .where(eq(apiKeys.id, id))
    .returning({ id: apiKeys.id });
  return updated.length;
}
