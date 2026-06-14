import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";

import * as schema from "./schema";

/**
 * Drizzle client bound to the D1 `DB` binding. Server-only; not yet used by any
 * route (Firestore is still primary). Used as data domains migrate to D1.
 */
export function getDb(): DrizzleD1Database<typeof schema> {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

/**
 * Raw drizzle client without the typed app schema — for the Better Auth adapter,
 * which manages its own tables and errors if handed the full app schema.
 */
export function getDbRaw(): DrizzleD1Database {
  const { env } = getCloudflareContext();
  return drizzle(env.DB);
}
