import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const internalLinkRules = sqliteTable(
  "internal_link_rules",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    keyword: text("keyword").notNull(),
    targetUrl: text("target_url").notNull(),
    maxPerArticle: integer("max_per_article"),
    createdAt: integer("created_at").notNull(), // epoch-ms
    updatedAt: integer("updated_at").notNull(), // epoch-ms
  },
  (t) => [index("internal_link_rules_blog_idx").on(t.blogId)],
);

export const sitemapEntries = sqliteTable(
  "sitemap_entries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    url: text("url").notNull(),
    // JSON-encoded string[] — parse on read, stringify on write
    urls: text("urls"),
    lastFetched: integer("last_fetched"), // epoch-ms
    createdAt: integer("created_at").notNull(), // epoch-ms
    updatedAt: integer("updated_at").notNull(), // epoch-ms
  },
  (t) => [index("sitemap_entries_blog_idx").on(t.blogId)],
);
