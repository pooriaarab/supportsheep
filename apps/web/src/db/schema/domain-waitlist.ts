import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

import { user } from "./auth";
import { blogs } from "./tenancy";

/**
 * Interest in custom domains, captured while Cloudflare for SaaS is not yet
 * enabled on the zone. One entry per blog (the unique index makes joining
 * idempotent); `countDomainWaitlist` powers the "N blogs interested" signal.
 */
export const domainWaitlist = sqliteTable(
  "domain_waitlist",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    // The member who joined the waitlist.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // The joiner's account email, kept for follow-up when domains ship.
    email: text("email").notNull(),
    // Epoch milliseconds.
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("domain_waitlist_blog_idx").on(t.blogId)],
);
