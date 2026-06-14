import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

/**
 * free_tools — one row per configured free tool per blog.
 *
 * JSON-TEXT columns store nested config objects (appearance, ai, seo, callout,
 * faq, cta) exactly as typed in @repo/types FreeTool.
 * Timestamps stored as epoch-ms integers.
 */
export const freeTools = sqliteTable(
  "free_tools",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    templateId: text("template_id").notNull(),
    source: text("source").notNull().default("predefined"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    metaTitle: text("meta_title").notNull().default(""),
    metaDescription: text("meta_description").notNull().default(""),
    intro: text("intro").notNull().default(""),
    // JSON-TEXT for nested fields
    faq: text("faq").notNull().default("[]"), // FreeToolFaqItem[]
    cta: text("cta").notNull().default("{}"), // FreeToolCtaConfig
    callout: text("callout").notNull().default("{}"), // FreeToolCalloutConfig
    appearance: text("appearance").notNull().default("{}"), // FreeToolAppearanceConfig
    ai: text("ai").notNull().default("{}"), // FreeToolAiConfig
    seo: text("seo").notNull().default("{}"), // FreeToolSeoConfig
    createdAt: integer("created_at").notNull(), // epoch-ms
    updatedAt: integer("updated_at").notNull(), // epoch-ms
  },
  (t) => [
    index("free_tools_blog_idx").on(t.blogId),
    uniqueIndex("free_tools_blog_slug_idx").on(t.blogId, t.slug),
  ],
);

/**
 * free_tool_usage — per-subject usage tracking for rate-limiting.
 *
 * The "subject" is an HMAC hash of (ip + userAgent + toolId + day + secret),
 * so no raw PII is stored. The composite unique index (blog_id, tool_id,
 * subject_hash, day) is the lookup key for read-modify-write.
 */
export const freeToolUsage = sqliteTable(
  "free_tool_usage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    blogId: text("blog_id").notNull().default("default"),
    toolId: text("tool_id").notNull(),
    day: text("day").notNull(), // "YYYYMMDD"
    subjectHash: text("subject_hash").notNull(), // hex-encoded HMAC-SHA256
    count: integer("count").notNull().default(0),
    firstUsedAt: integer("first_used_at").notNull(), // epoch-ms
    lastUsedAt: integer("last_used_at").notNull(), // epoch-ms
  },
  (t) => [
    index("free_tool_usage_blog_idx").on(t.blogId),
    uniqueIndex("free_tool_usage_lookup_idx").on(
      t.blogId,
      t.toolId,
      t.subjectHash,
      t.day,
    ),
  ],
);
