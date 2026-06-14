import { index, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

import { user } from "./auth";
import { blogs } from "./tenancy";

/**
 * A pending email invitation to join a blog. Used for people who do NOT yet have
 * a Better Auth account — an existing user is added to blog_members directly.
 *
 * The `token` is an unguessable nanoid(32): it is the only credential the accept
 * link carries, so it is treated as a secret (never logged). An invite can grant
 * only author/editor/viewer — never owner/admin (clamped at creation).
 */
export const blogInvites = sqliteTable(
  "blog_invites",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id")
      .notNull()
      .references(() => blogs.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    // author > editor > viewer — never owner/admin (clamped in the repository).
    role: text("role").notNull().default("viewer"),
    // Unguessable nanoid(32); the accept link's sole credential.
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Epoch milliseconds. Past this, the invite can no longer be accepted.
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
    // Set once when redeemed; a non-null value means the invite is spent.
    acceptedAt: integer("accepted_at"),
    acceptedBy: text("accepted_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("blog_invites_blog_idx").on(t.blogId),
    index("blog_invites_email_idx").on(t.email),
  ],
);
