import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/**
 * Fixed-window per-IP rate-limit counters.
 *
 * Each row is one `<key>:<ip>:<windowStartMs>` bucket. The limiter upserts the
 * bucket (insert-or-`count = count + 1`) per request and blocks once `count`
 * exceeds the route's `maxPerMinute`. `expiresAt` lets a best-effort sweep drop
 * stale rows. The unique index on `bucket` is what makes the upsert atomic.
 */
export const rateLimits = sqliteTable(
  "rate_limits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // `<key>:<ip>:<windowStartMs>` — the conflict target for the atomic upsert.
    bucket: text("bucket").notNull(),
    count: integer("count").notNull().default(0),
    windowStart: integer("window_start").notNull(), // epoch-ms
    expiresAt: integer("expires_at").notNull(), // epoch-ms
  },
  (t) => [uniqueIndex("rate_limits_bucket_idx").on(t.bucket)],
);
