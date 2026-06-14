/**
 * Zod Schemas for API Input Validation
 *
 * Used by API routes (via createApiHandler) to validate request bodies.
 * Keep schemas here as the single source of truth for input shapes.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Shared                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Featured image object with URL, alt text, and optional intrinsic dimensions.
 */
const featuredImageSchema = z.object({
  url: z.string().max(2000).default(""),
  alt: z.string().max(500).default(""),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const emptyFeaturedImage = { url: "", alt: "" };
const articleSlugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export const createNotificationSchema = z.object({
  type: z
    .enum(["info", "warning", "error", "success", "task", "mention", "system"])
    .default("info"),
  title: z.string().min(1, "Title is required").max(200),
  message: z.string().min(1, "Message is required").max(2000),
  actionUrl: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one ID is required"),
  read: z.boolean(),
});

export const deleteIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one ID is required"),
});

/* -------------------------------------------------------------------------- */
/* Articles                                                                    */
/* -------------------------------------------------------------------------- */

export const createArticleSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  body: z.string().default(""),
  draftBody: z.string().default(""),
  excerpt: z.string().max(500).default(""),
  summary: z.string().max(800).default(""),
  status: z
    .enum(["draft", "published", "scheduled", "archived"])
    .default("draft"),
  postType: z
    .enum([
      "blog_post",
      "listicle",
      "how_to",
      "comparison",
      "product_review",
      "pillar_page",
      "glossary",
      "landing_page",
    ])
    .default("blog_post"),
  category: z.string().max(100).default(""),
  primaryCategory: z.string().max(100).optional(),
  categories: z.array(z.string().max(100)).max(10).optional(),
  tags: z.array(z.string().max(50)).max(30).default([]),
  author: z.string().max(200).default(""),
  authorId: z.string().max(200).optional(),
  featuredImage: featuredImageSchema.default(emptyFeaturedImage),
  ogImage: z.string().max(2000).default(""),
  metaTitle: z.string().max(200).default(""),
  metaDescription: z.string().max(300).default(""),
  keywords: z.array(z.string().max(100)).max(20).default([]),
});

export const updateArticleSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save-draft"),
    draftBody: z.string(),
    note: z.string().max(200).default(""),
  }),
  z.object({
    action: z.literal("publish"),
  }),
  z.object({
    action: z.literal("unpublish"),
  }),
  z.object({
    action: z.literal("schedule"),
    scheduledAt: z.string().datetime(),
  }),
  z.object({
    action: z.literal("update-meta"),
    title: z.string().min(1).max(300).optional(),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(
        articleSlugRegex,
        "Slug must be lowercase alphanumeric with single dashes",
      )
      .optional(),
    excerpt: z.string().max(500).optional(),
    summary: z.string().max(800).optional(),
    category: z.string().max(100).optional(),
    primaryCategory: z.string().max(100).optional(),
    categories: z.array(z.string().max(100)).max(10).optional(),
    tags: z.array(z.string().max(50)).max(30).optional(),
    author: z.string().max(200).optional(),
    authorId: z.string().max(200).nullable().optional(),
    featuredImage: featuredImageSchema.optional(),
    ogImage: z.string().max(2000).optional(),
    metaTitle: z.string().max(200).optional(),
    metaDescription: z.string().max(300).optional(),
    keywords: z.array(z.string().max(100)).max(20).optional(),
    postType: z
      .enum([
        "blog_post",
        "listicle",
        "how_to",
        "comparison",
        "product_review",
        "pillar_page",
        "glossary",
        "landing_page",
      ])
      .optional(),
  }),
]);

export const bulkDeleteArticlesSchema = z.object({
  slugs: z
    .array(z.string().min(1))
    .min(1, "At least one slug is required")
    .max(100),
});

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

export const createCategorySchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  displayName: z.string().min(1, "Display name is required").max(100),
  icon: z.string().max(50).default(""),
  description: z.string().max(500).default(""),
});

export const updateCategorySchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  icon: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
});

export const reorderCategoriesSchema = z.object({
  order: z.record(z.string(), z.number().int().min(0)),
});

/* -------------------------------------------------------------------------- */
/* Generation                                                                  */
/* -------------------------------------------------------------------------- */

const postTypeEnum = z.enum([
  "blog_post",
  "listicle",
  "how_to",
  "comparison",
  "product_review",
  "pillar_page",
  "glossary",
  "landing_page",
]);

const aiProviderEnum = z.enum(["claude", "gpt", "gemini"]);

export const generateKeywordSchema = z.object({
  keyword: z.string().min(1, "Keyword is required").max(200),
  postType: postTypeEnum.default("blog_post"),
  contextTagId: z.string().max(200).optional(),
  provider: aiProviderEnum.default("claude"),
  scheduledAt: z.string().datetime().optional(),
});

export const generateBulkSchema = z.object({
  items: z
    .array(
      z.object({
        keyword: z.string().min(1).max(200),
        postType: postTypeEnum.default("blog_post"),
        contextTagId: z.string().max(200).optional(),
      }),
    )
    .min(1, "At least one keyword is required")
    .max(50, "Maximum 50 keywords per batch"),
  provider: aiProviderEnum.default("claude"),
});

export const generateContentPlanSchema = z.object({
  niche: z.string().min(1, "Niche is required").max(300),
  duration: z.enum(["7", "14", "30"]).default("30"),
  contextTagId: z.string().max(200).optional(),
  provider: aiProviderEnum.default("claude"),
});

/* -------------------------------------------------------------------------- */
/* Generate Image                                                               */
/* -------------------------------------------------------------------------- */

export const generateImageSchema = z.object({
  purpose: z.enum(["featured-image", "inline"]),
  slug: z.string().max(300).optional(),
  title: z.string().max(300).optional(),
  excerpt: z.string().max(800).optional(),
  category: z.string().max(100).optional(),
  imageStyle: z.string().max(200).optional(),
  imageColorScheme: z.string().max(200).optional(),
  imageAspectRatio: z.enum(["16:9", "1:1", "4:3"]).optional(),
  customPrompt: z.string().max(500).optional(),
}).refine(
  (d) => !!(d.slug || d.title || d.customPrompt?.trim()),
  { message: "Either slug, title, or customPrompt must be provided" },
).refine(
  (d) => d.purpose !== "featured-image" || !!d.slug,
  { message: "slug is required when purpose is featured-image", path: ["slug"] },
);

/* -------------------------------------------------------------------------- */
/* Generate Image Prompt                                                        */
/* -------------------------------------------------------------------------- */

export const generateImagePromptSchema = z.object({
  slug: z.string().max(300).optional(),
  title: z.string().max(300).optional(),
  excerpt: z.string().max(800).optional(),
  category: z.string().max(100).optional(),
}).refine(
  (d) => d.slug || d.title,
  { message: "Either slug or title must be provided" },
);

/* -------------------------------------------------------------------------- */
/* Context Tags                                                                */
/* -------------------------------------------------------------------------- */

export const createContextTagSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  targetAudience: z.string().max(500).default(""),
  tone: z.string().max(100).default("professional"),
  style: z.string().max(100).default("informative"),
  language: z.string().max(50).default("English"),
  articleLength: z
    .object({
      min: z.number().int().min(100).max(10000).default(1000),
      max: z.number().int().min(100).max(10000).default(2000),
    })
    .default({ min: 1000, max: 2000 }),
  cta: z
    .object({
      text: z.string().max(200).default(""),
      url: z.string().max(2000).default(""),
    })
    .default({ text: "", url: "" }),
  customPrompt: z.string().max(2000).default(""),
  imageSettings: z
    .object({
      style: z.string().max(100).default("realistic"),
      colorScheme: z.string().max(100).default(""),
      count: z.number().int().min(0).max(20).default(3),
      aspectRatio: z.string().max(20).default("16:9"),
    })
    .default({
      style: "realistic",
      colorScheme: "",
      count: 3,
      aspectRatio: "16:9",
    }),
});

export const updateContextTagSchema = createContextTagSchema.partial();

/* -------------------------------------------------------------------------- */
/* Writing Skills                                                              */
/* -------------------------------------------------------------------------- */

export const createWritingSkillSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).default(""),
  prompt: z.string().min(1, "Prompt is required").max(5000),
  provider: aiProviderEnum.default("claude"),
  model: z.string().max(100).default(""),
  enabled: z.boolean().default(true),
});

export const updateWritingSkillSchema = createWritingSkillSchema.partial();

export const reorderWritingSkillsSchema = z.object({
  order: z.record(z.string(), z.number().int().min(0)),
});

export const runSkillsPipelineSchema = z.object({
  content: z.string().min(1, "Content is required").max(100000),
  skillIds: z
    .array(z.string().min(1))
    .min(1, "At least one skill ID is required")
    .max(20),
});

/* -------------------------------------------------------------------------- */
/* Internal Link Rules                                                         */
/* -------------------------------------------------------------------------- */

export const createInternalLinkRuleSchema = z.object({
  keyword: z.string().min(1, "Keyword is required").max(200),
  targetUrl: z.string().url("Must be a valid URL").max(2000),
  maxPerArticle: z.number().int().min(1).max(50).default(2),
});

export const updateInternalLinkRuleSchema =
  createInternalLinkRuleSchema.partial();

export const suggestLinksSchema = z.object({
  content: z.string().min(1, "Content is required").max(100000),
  sitemapId: z.string().max(200).optional(),
});

/* -------------------------------------------------------------------------- */
/* Sitemaps                                                                    */
/* -------------------------------------------------------------------------- */

export const createSitemapSchema = z.object({
  url: z.string().url("Must be a valid URL").max(2000),
});

/* -------------------------------------------------------------------------- */
/* Authors                                                                     */
/* -------------------------------------------------------------------------- */

const authorSlugRegex = /^[a-z0-9-]+$/;

export const createAuthorSchema = z.object({
  id: z
    .string()
    .min(1, "Slug is required")
    .max(100)
    .regex(authorSlugRegex, "Slug must be lowercase alphanumeric with dashes"),
  name: z.string().min(1, "Name is required").max(200),
  jobTitle: z.string().max(200).optional(),
  bio: z.string().max(5000).default(""),
  avatarUrl: z
    .string()
    .url("Avatar must be a valid URL")
    .max(2000)
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Must be a valid email address")
    .max(320)
    .optional()
    .or(z.literal("")),
  sameAs: z
    .array(z.string().url("Each link must be a valid URL").max(2000))
    .max(20)
    .default([]),
});

export const updateAuthorSchema = createAuthorSchema.partial().omit({ id: true });
