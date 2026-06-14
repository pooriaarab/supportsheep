/**
 * Content Generation Pipeline
 *
 * Orchestrates the keyword-to-article flow:
 * 1. Resolve context tag (brand voice)
 * 2. Load internal link rules + sitemap URLs
 * 3. Select post type template
 * 4. Generate title via AI
 * 5. Generate body via AI
 * 6. Save article to D1
 */

import "server-only";

import type { PostType } from "@repo/types";
import { generateContent } from "@/lib/ai/generate";
import type { AIProvider } from "@/lib/ai/providers";
import { getContextTag } from "@/lib/context-tags/repository";
import { getInternalLinkRulesForBlog } from "@/lib/seo/internal-link-rules-repository";
import { listSitemapsForBlog } from "@/lib/seo/sitemaps-repository";
import { getBlogConfig } from "@/lib/blog-config";
import { createArticle } from "@/lib/articles/repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";
import { createLogger } from "@/lib/logger";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";
import { POST_TYPE_TEMPLATES, VOICE_GUARDRAIL } from "./templates";
import { generateSlug } from "./slug";

const log = createLogger("lib:generation:pipeline");

/**
 * Fetch a featured image from Unsplash for the given query.
 * Returns the image URL or empty string if unavailable.
 */
async function fetchUnsplashImage(
  query: string,
  apiKey: string,
): Promise<string> {
  try {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "1");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${apiKey}` },
    });

    if (!res.ok) {
      log.warn("Unsplash API request failed", { status: res.status });
      return "";
    }

    const data = (await res.json()) as {
      results?: { urls?: { regular?: string } }[];
    };
    return data.results?.[0]?.urls?.regular ?? "";
  } catch (err) {
    log.warn("Failed to fetch Unsplash image", { err });
    return "";
  }
}

interface GenerateFromKeywordOpts {
  keyword: string;
  postType: PostType;
  contextTagId?: string;
  provider: AIProvider;
  scheduledAt?: string;
  generatedBy?: "keyword" | "bulk" | "content_plan";
  /** Tenant blog to generate into. Defaults to DEFAULT_BLOG_ID. */
  blogId?: string;
}

interface GenerateResult {
  slug: string;
  title: string;
  articleId: string;
}

/**
 * Generate a full article from a keyword.
 */
export async function generateFromKeyword(
  opts: GenerateFromKeywordOpts,
): Promise<GenerateResult> {
  const {
    keyword,
    postType,
    contextTagId,
    provider,
    scheduledAt,
    generatedBy = "keyword",
    blogId = DEFAULT_BLOG_ID,
  } = opts;

  log.info("Starting generation", {
    keyword,
    postType,
    provider,
    contextTagId,
  });

  // 1. Resolve context tag
  const contextTag = contextTagId
    ? await getContextTag(blogId, contextTagId)
    : null;

  // 2. Get internal link rules
  const linkRules = await getInternalLinkRulesForBlog(blogId, 50);

  // 3. Get sitemap URLs for internal linking context
  const sitemapEntries = await listSitemapsForBlog(blogId, 5);
  const sitemapUrls = sitemapEntries.flatMap((s) => s.urls);

  // 4. Get post type template
  const template = POST_TYPE_TEMPLATES[postType];

  // 5. Build context additions
  const contextParts: string[] = [];

  if (contextTag) {
    contextParts.push(`Target audience: ${contextTag.targetAudience}`);
    contextParts.push(`Tone: ${contextTag.tone}`);
    contextParts.push(`Style: ${contextTag.style}`);
    contextParts.push(`Language: ${contextTag.language}`);
    if (contextTag.customPrompt) {
      contextParts.push(`Additional instructions: ${contextTag.customPrompt}`);
    }
    if (contextTag.cta?.text) {
      contextParts.push(
        `Call-to-action: "${contextTag.cta.text}" linking to ${contextTag.cta.url}`,
      );
    }
  }

  if (linkRules.length > 0) {
    const rulesText = linkRules
      .map(
        (r) =>
          `When mentioning "${r.keyword}", link to ${r.targetUrl} (max ${r.maxPerArticle} times)`,
      )
      .join("\n");
    contextParts.push(`\nInternal linking rules:\n${rulesText}`);
  }

  if (sitemapUrls.length > 0) {
    contextParts.push(
      `\nExisting site URLs for internal linking:\n${sitemapUrls.slice(0, 30).join("\n")}`,
    );
  }

  const wordTarget = contextTag?.articleLength
    ? `${contextTag.articleLength.min}-${contextTag.articleLength.max}`
    : `${template.wordRange.min}-${template.wordRange.max}`;

  const contextBlock =
    contextParts.length > 0 ? `\n\nContext:\n${contextParts.join("\n")}` : "";

  // 6. Generate title
  const titleText = await generateContent({
    provider,
    systemPrompt: `You are an SEO headline writer. Generate exactly ONE compelling, click-worthy title for a blog post. Output only the title text, nothing else. No quotes, no numbering.\n${VOICE_GUARDRAIL}`,
    userPrompt: `Write a title for a ${template.name.toLowerCase()} about: "${keyword}"${contextBlock}`,
    temperature: 0.8,
    maxTokens: 100,
  });
  const title = titleText.trim().replace(/^["']|["']$/g, "");

  log.info("Title generated", { keyword, title });

  // 7. Generate body
  const bodySystemPrompt = `${template.systemPrompt}${contextBlock}`;
  const body = await generateContent({
    provider,
    systemPrompt: bodySystemPrompt,
    userPrompt: `Write a ${template.name.toLowerCase()} about: "${keyword}"\n\nTitle: ${title}\nTarget word count: ${wordTarget} words.`,
    temperature: 0.7,
    maxTokens: 8192,
  });

  log.info("Body generated", {
    keyword,
    wordCount: body.split(/\s+/).filter(Boolean).length,
  });

  // 8. Generate SEO metadata
  log.info("Generating SEO metadata", { keyword });

  let seoCategory = "uncategorized";
  let seoTags: string[] = [];
  let seoMetaDescription = "";
  let seoMetaTitle = title.length > 60 ? title.slice(0, 57) + "..." : title;

  try {
    const seoRaw = await generateContent({
      provider,
      systemPrompt: `Generate SEO metadata for this blog post. Return ONLY valid JSON (no markdown fences) with these fields: metaTitle (50-60 chars, compelling for search), metaDescription (150-160 chars, includes primary keyword), tags (array of 3-5 relevant keyword phrases), category (single broad topic category).\n${VOICE_GUARDRAIL}`,
      userPrompt: `Title: ${title}\nKeyword: ${keyword}\nExcerpt: ${body.substring(0, 500)}`,
      temperature: 0.3,
      maxTokens: 300,
    });

    const cleaned = seoRaw
      .replace(/```(?:json)?\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const seoFields = JSON.parse(cleaned) as {
      metaTitle?: string;
      metaDescription?: string;
      tags?: string[];
      category?: string;
    };

    if (seoFields.metaTitle && seoFields.metaTitle.length <= 70) {
      seoMetaTitle = seoFields.metaTitle;
    }
    if (seoFields.metaDescription && seoFields.metaDescription.length <= 200) {
      seoMetaDescription = seoFields.metaDescription;
    }
    if (Array.isArray(seoFields.tags)) {
      seoTags = seoFields.tags.slice(0, 5).map(String);
    }
    if (seoFields.category) {
      seoCategory = seoFields.category;
    }

    log.info("SEO metadata generated", {
      seoMetaTitle,
      seoCategory,
      tagCount: seoTags.length,
    });
  } catch (err) {
    log.warn("Failed to parse SEO metadata, using defaults", { err });
  }

  // 9. Fetch featured image from Unsplash (if configured)
  let featuredImage = "";
  try {
    const blogConfig = await getBlogConfig(blogId);
    const unsplashKey = blogConfig?.images?.unsplash?.apiKey;

    if (unsplashKey) {
      featuredImage = await fetchUnsplashImage(keyword, unsplashKey);
      if (featuredImage) {
        log.info("Featured image fetched from Unsplash", { keyword });
      }
    }
  } catch (err) {
    log.warn("Failed to load Unsplash config", { err });
  }

  // 10. Generate slug and ensure uniqueness
  let slug = generateSlug(title);

  // 11. Save article — createArticle checks slug uniqueness internally and
  //     returns { ok: false, reason: "duplicate" } on collision.
  const sanitizedDraftBody = sanitizeArticleHtml(body);
  const wordCount = sanitizedDraftBody.split(/\s+/).filter(Boolean).length;
  const now = new Date().toISOString();

  const articleData = {
    blogId,
    title,
    slug,
    body: "",
    draftBody: sanitizedDraftBody,
    excerpt: "",
    summary: "",
    status: (scheduledAt ? "scheduled" : "draft") as "scheduled" | "draft",
    scheduledAt: scheduledAt ?? null,
    publishedAt: null,
    postType,
    category: seoCategory,
    tags: seoTags,
    author: "",
    featuredImage: { url: featuredImage, alt: "" },
    ogImage: featuredImage,
    metaTitle: seoMetaTitle,
    metaDescription: seoMetaDescription,
    keywords: [keyword],
    seoScore: 0,
    internalLinks: [] as { anchor: string; url: string }[],
    externalLinks: [] as { anchor: string; url: string }[],
    versions: [] as import("@repo/types").ArticleVersion[],
    generatedBy: generatedBy as "keyword" | "bulk" | "content_plan",
    generationMeta: {
      keyword,
      contextTagId: contextTagId ?? "",
      provider,
      model: "",
      postTypeTemplate: postType,
      skillsPipelineRun: [] as string[],
    },
    wordCount,
    readingTime: Math.max(1, Math.ceil(wordCount / 200)),
    createdAt: now,
    updatedAt: now,
  };

  let result = await createArticle(blogId, articleData);

  // On slug collision, append a short suffix and retry once.
  if (!result.ok && result.reason === "duplicate") {
    slug = `${slug}-${Date.now().toString(36)}`;
    result = await createArticle(blogId, { ...articleData, slug });
  }

  if (!result.ok) {
    throw new Error(`Failed to save generated article: slug "${slug}" already exists`);
  }

  log.info("Article saved", { slug, articleId: result.article.id });

  return { slug, title, articleId: result.article.id };
}
