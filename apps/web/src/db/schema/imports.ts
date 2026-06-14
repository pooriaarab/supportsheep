import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/**
 * wordpress_imports — tracks WordPress WXR import job progress.
 *
 * The `failed_posts` column stores a JSON array of { slug, error } objects.
 * Timestamps are epoch-ms integers (null where not yet applicable).
 */
export const wordpressImports = sqliteTable(
  "wordpress_imports",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    /** Import source type (always "wordpress" for this table). */
    source: text("source").notNull().default("wordpress"),
    /** Current status: "running" | "completed" | "failed" */
    status: text("status").notNull().default("running"),
    totalPosts: integer("total_posts").notNull().default(0),
    importedPosts: integer("imported_posts").notNull().default(0),
    rehostedImages: integer("rehosted_images").notNull().default(0),
    /** JSON array of { slug: string, error: string } objects. */
    failedPosts: text("failed_posts").notNull().default("[]"),
    createdBy: text("created_by"),
    startedAt: integer("started_at"), // epoch-ms
    completedAt: integer("completed_at"), // epoch-ms, null until finished
    createdAt: integer("created_at").notNull(), // epoch-ms
    updatedAt: integer("updated_at").notNull(), // epoch-ms
  },
  (t) => [
    index("wordpress_imports_blog_idx").on(t.blogId),
    index("wordpress_imports_blog_created_idx").on(t.blogId, t.createdAt),
  ],
);
