import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/**
 * Invite / verification codes that authorize an agent (or person) to provision
 * an account on a blog without an interactive signup. An admin issues a code
 * scoped to a blog + membership role; the redeemer exchanges it for an account
 * and an API key. The code itself is the verification — possession proves the
 * agent was authorized by an admin.
 */
export const signupCodes = sqliteTable(
  "signup_codes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    // Random, unguessable invite token (nanoid(24)); shared with the redeemer.
    code: text("code").notNull(),
    // The blog the redeemer joins on redemption.
    blogId: text("blog_id").notNull(),
    // Membership role granted on redemption (capped at editor — see repository).
    role: text("role").notNull().default("author"),
    note: text("note"),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    expiresAt: integer("expires_at"), // epoch-ms, nullable
    createdBy: text("created_by").notNull(), // userId
    createdAt: integer("created_at").notNull(), // epoch-ms
  },
  (t) => [
    uniqueIndex("signup_codes_code_idx").on(t.code),
    index("signup_codes_blog_idx").on(t.blogId),
  ],
);
