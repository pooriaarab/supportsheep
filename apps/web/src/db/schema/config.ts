import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Singleton JSON blob per blog: stores the user-supplied BlogConfig overrides.
 * getBlogConfig() applies defaults on top via mergeBlogConfig().
 */
export const blogConfig = sqliteTable("blog_config", {
  blogId: text("blog_id").primaryKey(),
  data: text("data").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/**
 * Singleton JSON blob per blog: stores application settings overrides
 * (settings/general in the previous Firestore model).
 */
export const blogSettings = sqliteTable("blog_settings", {
  blogId: text("blog_id").primaryKey(),
  data: text("data").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
