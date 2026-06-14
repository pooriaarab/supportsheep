import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/**
 * integrations — one row per configured integration per blog.
 *
 * The `config` TEXT column stores a JSON blob (varies by type):
 *   - webhook integrations: StoredWebhookIntegrationConfig (token, endpoint, etc.)
 *   - oauth integrations: StoredGoogleIntegrationConfig (client id/secret,
 *     oauth state, oauth tokens — stored plaintext as in the original Firestore
 *     implementation; encrypt-at-rest is a future security follow-up)
 *   - api_key integrations: arbitrary key/value map
 *
 * Timestamps are epoch-ms integers.
 */
export const integrations = sqliteTable(
  "integrations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    name: text("name").notNull(),
    type: text("type").notNull(), // "oauth" | "api_key" | "webhook"
    status: text("status").notNull().default("disconnected"), // "connected" | "disconnected" | "error"
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default(""),
    config: text("config").notNull().default("{}"), // JSON blob
    connectedAt: integer("connected_at"), // epoch-ms, nullable
    createdAt: integer("created_at").notNull(), // epoch-ms
    updatedAt: integer("updated_at").notNull(), // epoch-ms
  },
  (t) => [
    index("integrations_blog_idx").on(t.blogId),
    index("integrations_blog_type_idx").on(t.blogId, t.type),
  ],
);
