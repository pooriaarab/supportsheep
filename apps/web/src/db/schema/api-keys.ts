import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    ownerId: text("owner_id").notNull(),
    blogId: text("blog_id").notNull().default("default"),
    name: text("name").notNull(),
    keyPreview: text("key_preview").notNull(),
    keyHash: text("key_hash").notNull(),
    scopes: text("scopes").notNull(), // JSON array
    lastUsed: integer("last_used"), // epoch-ms, nullable
    createdAt: integer("created_at").notNull(), // epoch-ms
  },
  (t) => [
    index("api_keys_owner_idx").on(t.ownerId),
    uniqueIndex("api_keys_key_hash_idx").on(t.keyHash),
  ],
);
