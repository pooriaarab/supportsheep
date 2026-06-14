import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/**
 * media — metadata for uploaded files.
 *
 * File bytes live in Firebase Storage (storagePath) — migrated to R2 later.
 * Timestamps are epoch-ms integers.
 */
export const media = sqliteTable(
  "media",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    filename: text("filename").notNull(),
    url: text("url").notNull(),
    storagePath: text("storage_path").notNull().default(""),
    mimeType: text("mime_type").notNull().default(""),
    size: integer("size").notNull().default(0),
    width: integer("width").notNull().default(0),
    height: integer("height").notNull().default(0),
    alt: text("alt").notNull().default(""),
    uploadedBy: text("uploaded_by").notNull().default(""),
    createdAt: integer("created_at").notNull(), // epoch-ms (was uploadedAt in Firestore)
    updatedAt: integer("updated_at").notNull(), // epoch-ms
  },
  (t) => [
    index("media_blog_idx").on(t.blogId),
    index("media_blog_created_idx").on(t.blogId, t.createdAt),
  ],
);
